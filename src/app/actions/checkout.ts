"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { orderItems, orders } from "@/db/schema";
import { getCurrentCartId, readCart } from "@/lib/cart";
import { coverUrl, getBookDetails } from "@/lib/openlibrary";
import {
  CURRENCY,
  EXPRESS_SHIPPING_CENTS,
  FREE_SHIPPING_FROM_CENTS,
  priceCentsFor,
  STANDARD_SHIPPING_CENTS,
} from "@/lib/pricing";
import { findAddress, toStripeShipping } from "@/lib/addresses";
import { getOrCreateStripeCustomerId } from "@/lib/saved-cards";
import { getCurrentUser } from "@/lib/session";
import { getStripe } from "@/lib/stripe";

// `form` carries the delivery address picked in the cart (signed-in customers only):
// an address id, "new" to type one on the payment page, or nothing for guests.
export async function startCheckout(form: FormData): Promise<{ error: string }> {
  const siteUrl = process.env.SITE_URL;
  if (!siteUrl) throw new Error("SITE_URL is not set. Add it to .env.local.");

  const user = await getCurrentUser(); // null when buying as a guest
  const cartId = await getCurrentCartId();
  const cart = await readCart();
  if (!cartId || cart.length === 0) return { error: "Your cart is empty." };

  // Prices are worked out again here, on the server. Nothing the browser sends decides what anyone pays.
  const lines = (
    await Promise.all(
      cart.map(async (item) => {
        const result = await getBookDetails(item.bookId);
        if (result.status !== "found") return null;
        const { book } = result;
        return {
          bookId: book.id,
          title: book.title,
          coverId: book.coverId,
          quantity: item.quantity,
          unitPrice: priceCentsFor(book.id, book.pages),
        };
      }),
    )
  ).filter((line) => line !== null);
  if (lines.length === 0) return { error: "None of the books in your cart are available right now." };

  const subtotal = lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);

  // 1. Save the order first, with titles and prices exactly as they are right now.
  const order = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(orders)
      .values({ cartId, userId: user?.id ?? null, currency: CURRENCY, subtotalCents: subtotal })
      .returning({ id: orders.id });
    await tx.insert(orderItems).values(
      lines.map((line) => ({
        orderId: created.id,
        bookId: line.bookId,
        title: line.title,
        unitPriceCents: line.unitPrice,
        quantity: line.quantity,
      })),
    );
    return created;
  });

  // 2. Ask Stripe for a payment page for exactly these lines.
  let paymentPageUrl: string;
  try {
    // Signed in: pay as this account's Stripe customer. That's what lets Stripe offer the cards saved
    // before, and save a new one if you tick the box. The chosen address goes on the customer first,
    // so the payment page opens with it filled in (it can still be changed there).
    let customer: string | undefined;
    if (user) {
      customer = await getOrCreateStripeCustomerId(user);
      const address = await findAddress(user.id, String(form.get("addressId") ?? ""));
      await getStripe().customers.update(customer, { shipping: address ? toStripeShipping(address) : "" });
    }

    const freeStandard = subtotal >= FREE_SHIPPING_FROM_CENTS;
    const session = await getStripe().checkout.sessions.create(
      {
        mode: "payment",
        line_items: lines.map((line) => ({
          quantity: line.quantity,
          price_data: {
            currency: CURRENCY,
            unit_amount: line.unitPrice,
            product_data: {
              name: line.title,
              images: line.coverId ? [coverUrl(line.coverId, "M")] : undefined,
            },
          },
        })),
        customer,
        // Show "save my card" on the payment page, and let saved cards be removed there too.
        saved_payment_method_options: customer ? { payment_method_save: "enabled", payment_method_remove: "enabled" } : undefined,
        shipping_address_collection: { allowed_countries: ["RO"] },
        shipping_options: [
          {
            shipping_rate_data: {
              type: "fixed_amount",
              display_name: freeStandard ? "Standard (free from €50)" : "Standard",
              fixed_amount: { amount: freeStandard ? 0 : STANDARD_SHIPPING_CENTS, currency: CURRENCY },
              delivery_estimate: {
                minimum: { unit: "business_day", value: 2 },
                maximum: { unit: "business_day", value: 4 },
              },
            },
          },
          {
            shipping_rate_data: {
              type: "fixed_amount",
              display_name: "Express",
              fixed_amount: { amount: EXPRESS_SHIPPING_CENTS, currency: CURRENCY },
              delivery_estimate: {
                minimum: { unit: "business_day", value: 1 },
                maximum: { unit: "business_day", value: 1 },
              },
            },
          },
        ],
        // Only our own ID goes to Stripe, never personal data. The webhook uses it to find the order.
        client_reference_id: order.id,
        metadata: { orderId: order.id },
        success_url: `${siteUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${siteUrl}/cart`,
        expires_at: Math.floor(Date.now() / 1000) + 60 * 60, // the payment page stays open for 1 hour
      },
      { idempotencyKey: order.id }, // if this request is retried, Stripe returns the same session instead of a new one
    );

    await db.update(orders).set({ stripeSessionId: session.id }).where(eq(orders.id, order.id));
    if (!session.url) throw new Error("Stripe did not return a payment page URL.");
    paymentPageUrl = session.url;
  } catch (error) {
    console.error("Could not create a Stripe Checkout Session:", error);
    await db.delete(orders).where(eq(orders.id, order.id)); // its items are deleted with it (cascade)
    return { error: "Could not start the payment. Try again in a minute." };
  }

  // 3. Send the browser to Stripe. redirect() works by throwing, so it must stay outside try/catch.
  redirect(paymentPageUrl);
}
