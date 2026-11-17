import { and, asc, desc, eq, inArray, isNull, or, type SQL, sql } from "drizzle-orm";
import { after } from "next/server";
import { db } from "@/db";
import { cartItems, orderItems, orders, type ShipmentEventType, shipmentEvents, shipments } from "@/db/schema";
import { orderConfirmationEmail } from "@/emails/order-confirmation";
import { rememberAddress } from "@/lib/addresses";
import { CARRIER_NAME, planShipment } from "@/lib/courier";
import { sendEmail } from "@/lib/email";
import { findPlace } from "@/lib/romania";
import { getStripe } from "@/lib/stripe";

// Called by the webhook AND by the success page. Whichever arrives first does the work;
// the second call finds the order already paid and changes nothing (and sends no second email).
export async function fulfillCheckout(sessionId: string): Promise<void> {
  // Always ask Stripe directly. Never trust payment information that came through a browser.
  const session = await getStripe().checkout.sessions.retrieve(sessionId);
  if (session.mode !== "payment") return; // e.g. the "add a card" page: no order involved
  if (session.payment_status === "unpaid") return; // not paid (yet), nothing to do

  const orderId = session.metadata?.orderId;
  if (!orderId) return;

  const shipping = session.collected_information?.shipping_details;
  const paymentIntentId =
    typeof session.payment_intent === "string" ? session.payment_intent : (session.payment_intent?.id ?? null);
  const paidAt = new Date();

  // The transaction returns the order's id only if THIS call is the one that marked it paid.
  const paidOrderId = await db.transaction(async (tx) => {
    // "AND status = 'pending'" is what makes repeats harmless: only the first call matches a row.
    const [order] = await tx
      .update(orders)
      .set({
        status: "paid",
        paidAt,
        email: session.customer_details?.email ?? null,
        totalCents: session.amount_total,
        shippingCents: session.total_details?.amount_shipping ?? null,
        shippingName: shipping?.name ?? null,
        shippingAddress: shipping?.address ?? null,
        stripePaymentIntentId: paymentIntentId,
      })
      .where(and(eq(orders.id, orderId), eq(orders.stripeSessionId, session.id), eq(orders.status, "pending")))
      .returning({ id: orders.id, cartId: orders.cartId, userId: orders.userId });

    if (!order) return null; // already handled earlier

    // Hand the parcel to the courier: plan every step of the trip to the buyer's town.
    const destination = findPlace(shipping?.address?.city, shipping?.address?.state);
    const plan = planShipment(destination, paidAt);
    const [shipment] = await tx
      .insert(shipments)
      .values({ orderId: order.id, carrier: CARRIER_NAME, trackingNumber: plan.trackingNumber })
      .returning({ id: shipments.id });
    await tx.insert(shipmentEvents).values(
      plan.events.map((event) => ({
        shipmentId: shipment.id,
        type: event.type,
        description: event.description,
        locationName: event.place.name,
        lat: event.place.lat,
        lng: event.place.lng,
        happensAt: event.happensAt,
      })),
    );

    // Signed-in customer: keep the address they used, so next time it's already in their address book.
    // It runs in a "savepoint" (a transaction inside the transaction): if saving the address fails,
    // only that part is undone. A bad address must never undo marking a real payment as paid.
    const userId = order.userId;
    if (userId) {
      await tx
        .transaction((savepoint) => rememberAddress(savepoint, userId, shipping?.name, shipping?.address))
        .catch((error) => console.error("Could not save the order's address:", error));
    }

    // Take the books that were just bought out of the cart. Anything added since stays there.
    if (order.cartId) {
      const bought = await tx.select({ bookId: orderItems.bookId }).from(orderItems).where(eq(orderItems.orderId, order.id));
      if (bought.length > 0) {
        await tx.delete(cartItems).where(
          and(
            eq(cartItems.cartId, order.cartId),
            inArray(
              cartItems.bookId,
              bought.map((item) => item.bookId),
            ),
          ),
        );
      }
    }

    return order.id;
  });

  if (!paidOrderId) return;

  // Email the buyer. after() runs this once the response has been sent, so neither Stripe (waiting
  // on the webhook) nor the buyer (waiting on the thank-you page) waits for the mail server.
  // It sits outside the transaction on purpose: the email only goes out once the order is saved,
  // and a mail server that's down can't undo a payment that already happened.
  after(async () => {
    try {
      await sendOrderConfirmation(paidOrderId);
    } catch (error) {
      console.error(`Could not send the confirmation email for order ${paidOrderId}:`, error);
    }
  });
}

async function sendOrderConfirmation(orderId: string): Promise<void> {
  const order = await getOrderDetails(orderId);
  if (!order?.email) return; // Stripe always collects an email, but never assume

  const siteUrl = process.env.SITE_URL;
  if (!siteUrl) throw new Error("SITE_URL is not set, so the email can't link back to the shop.");

  await sendEmail({ to: order.email, ...orderConfirmationEmail(order, siteUrl) });
}

// The buyer never paid and Stripe closed the payment page.
export async function expireCheckout(sessionId: string): Promise<void> {
  await db
    .update(orders)
    .set({ status: "expired" })
    .where(and(eq(orders.stripeSessionId, sessionId), eq(orders.status, "pending")));
}

export async function getOrderBySessionId(sessionId: string) {
  const [order] = await db.select().from(orders).where(eq(orders.stripeSessionId, sessionId));
  if (!order) return null;
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, order.id));
  return { ...order, items };
}

// Everything the order page needs: the order, its books, the parcel and every step of its trip.
export async function getOrderDetails(orderId: string) {
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId));
  if (!order) return null;

  const [items, [shipment]] = await Promise.all([
    db.select().from(orderItems).where(eq(orderItems.orderId, order.id)),
    db.select().from(shipments).where(eq(shipments.orderId, order.id)),
  ]);
  const events = shipment
    ? await db
        .select()
        .from(shipmentEvents)
        .where(eq(shipmentEvents.shipmentId, shipment.id))
        .orderBy(asc(shipmentEvents.happensAt))
    : [];

  return { ...order, items, shipment: shipment ?? null, events };
}

export type OrderDetails = NonNullable<Awaited<ReturnType<typeof getOrderDetails>>>;

// A signed-in customer's orders: the ones placed while signed in, plus the ones placed as a guest
// with the same email. Safe because nobody can sign in before proving they own that email.
export async function listOrdersForUser(user: { id: string; email: string; emailVerified: boolean }) {
  const placedSignedIn = eq(orders.userId, user.id);
  const placedAsGuest = and(isNull(orders.userId), sql`lower(${orders.email}) = lower(${user.email})`);
  return listPaidOrders(user.emailVerified ? or(placedSignedIn, placedAsGuest)! : placedSignedIn);
}

// Without an account: the orders placed from this browser (they share the cart cookie).
export async function listOrdersForCart(cartId: string) {
  return listPaidOrders(eq(orders.cartId, cartId));
}

// Paid orders matching `which`, newest first, each with the latest step its parcel has reached.
// Checkouts that were abandoned or never paid stay in the database but are never listed:
// the buyer doesn't think of them as orders.
async function listPaidOrders(which: SQL) {
  // Two small subqueries in plain SQL. The table aliases (e, s, oi) keep every column name
  // unambiguous; "orders"."id" refers to the order in the row being listed.
  const latestEvent = sql<ShipmentEventType | null>`(
    select e.type from shipment_events e
    join shipments s on s.id = e.shipment_id
    where s.order_id = "orders"."id" and e.happens_at <= now()
    order by e.happens_at desc
    limit 1
  )`;
  const itemCount = sql<number>`(
    select coalesce(sum(oi.quantity), 0)::int from order_items oi where oi.order_id = "orders"."id"
  )`;

  return db
    .select({
      id: orders.id,
      paidAt: orders.paidAt,
      totalCents: orders.totalCents,
      latestEvent,
      itemCount,
    })
    .from(orders)
    .where(and(which, eq(orders.status, "paid")))
    .orderBy(desc(orders.paidAt));
}
