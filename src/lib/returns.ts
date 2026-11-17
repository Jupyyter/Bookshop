import { and, desc, eq, inArray, isNull, lt, lte, or, sql } from "drizzle-orm";
import type Stripe from "stripe";
import { db } from "@/db";
import { orderItems, orders, type Return, returnItems, returns } from "@/db/schema";
import { refundSentEmail } from "@/emails/returns";
import type { User } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import type { OrderDetails } from "@/lib/orders";
import { RETURN_STEPS, RETURN_WINDOW_DAYS } from "@/lib/return-rules";
import { getStripe } from "@/lib/stripe";

// ---------- who may return what ----------

// The order's owner: placed while signed in to this account, or as a guest with this (verified) email.
export function ownsOrder(user: User, order: { userId: string | null; email: string | null }): boolean {
  if (order.userId) return order.userId === user.id;
  return user.emailVerified && !!order.email && order.email.toLowerCase() === user.email.toLowerCase();
}

export type Eligibility =
  | { ok: true; deliveredAt: Date; deadline: Date }
  | { ok: false; why: "not-delivered" | "too-late" | "nothing-left"; deadline?: Date };

// Returns open once the parcel is delivered, and close RETURN_WINDOW_DAYS days later.
export function returnWindow(order: OrderDetails, now = new Date()): Eligibility {
  const delivered = order.events.find((event) => event.type === "delivered");
  if (!delivered || delivered.happensAt > now) return { ok: false, why: "not-delivered" };
  const deadline = new Date(delivered.happensAt.getTime() + RETURN_WINDOW_DAYS * 24 * 60 * 60_000);
  if (now > deadline) return { ok: false, why: "too-late", deadline };
  return { ok: true, deliveredAt: delivered.happensAt, deadline };
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

// Each book of the order with how many copies can still be returned (bought minus already returned).
export async function returnableLines(orderId: string, tx: Tx | typeof db = db) {
  const returned = tx
    .select({ bookId: returnItems.bookId, quantity: sql<number>`sum(${returnItems.quantity})::int`.as("returned") })
    .from(returnItems)
    .innerJoin(returns, eq(returns.id, returnItems.returnId))
    .where(eq(returns.orderId, orderId))
    .groupBy(returnItems.bookId)
    .as("returned");

  const rows = await tx
    .select({
      bookId: orderItems.bookId,
      title: orderItems.title,
      unitPriceCents: orderItems.unitPriceCents,
      bought: orderItems.quantity,
      returned: sql<number>`coalesce(${returned.quantity}, 0)`,
    })
    .from(orderItems)
    .leftJoin(returned, eq(returned.bookId, orderItems.bookId))
    .where(eq(orderItems.orderId, orderId))
    .orderBy(orderItems.title);
  return rows.map((row) => ({ ...row, left: row.bought - row.returned }));
}

// ---------- reading returns ----------

export async function listReturnsForUser(userId: string) {
  return db.select().from(returns).where(eq(returns.userId, userId)).orderBy(desc(returns.createdAt));
}

export async function listReturnsForOrder(orderId: string) {
  return db.select().from(returns).where(eq(returns.orderId, orderId)).orderBy(desc(returns.createdAt));
}

export async function getReturn(returnId: string) {
  const [found] = await db.select().from(returns).where(eq(returns.id, returnId));
  if (!found) return null;
  const items = await db.select().from(returnItems).where(eq(returnItems.returnId, returnId)).orderBy(returnItems.title);
  return { ...found, items };
}

const FINAL = ["succeeded", "failed", "canceled"];

// Where the return is right now. Like the parcel tracking, the trip is planned in advance and a step
// counts once its time has passed; the last step depends on what Stripe says about the refund.
export function returnProgress(ret: Return, now = new Date()) {
  const refunded = ret.refundStatus === "succeeded";
  const problem = ret.refundStatus === "failed" || ret.refundStatus === "canceled";
  const step = refunded ? 3 : ret.receivedAt <= now ? 2 : ret.droppedOffAt <= now ? 1 : 0;

  let label: string;
  if (refunded) label = "Refunded";
  else if (problem) label = "Refund problem";
  else if (ret.stripeRefundId) label = "Refund on its way";
  else if (ret.receivedAt <= now) label = "Received, refund coming";
  else label = RETURN_STEPS[step];

  return { step, label, done: refunded || problem };
}

// ---------- refunds ----------

// Called after pages that show returns have been sent (see after() in those pages): every return whose
// books have "arrived" by now gets its refund sent to Stripe. In production a scheduled job would call
// this every few minutes too, so refunds don't wait for someone to open a page.
export async function processDueRefunds(): Promise<void> {
  const now = new Date();
  const fiveMinutesAgo = new Date(now.getTime() - 5 * 60_000);
  const due = await db
    .select({ id: returns.id })
    .from(returns)
    .where(
      and(
        lte(returns.refundDueAt, now),
        or(isNull(returns.refundStatus), and(eq(returns.refundStatus, "processing"), lt(returns.refundAttemptedAt, fiveMinutesAgo))),
      ),
    )
    .limit(20);
  for (const { id } of due) await sendRefund(id);
}

async function sendRefund(returnId: string): Promise<void> {
  // Claim the return first, so two visitors loading pages at the same moment can't both refund it.
  // (A claim older than 5 minutes is taken over: whoever made it must have crashed halfway.)
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60_000);
  const [claimed] = await db
    .update(returns)
    .set({ refundStatus: "processing", refundAttemptedAt: new Date() })
    .where(
      and(
        eq(returns.id, returnId),
        isNull(returns.stripeRefundId),
        or(isNull(returns.refundStatus), and(eq(returns.refundStatus, "processing"), lt(returns.refundAttemptedAt, fiveMinutesAgo))),
      ),
    )
    .returning();
  if (!claimed) return;

  const [order] = await db.select({ paymentIntent: orders.stripePaymentIntentId }).from(orders).where(eq(orders.id, claimed.orderId));
  try {
    if (!order?.paymentIntent) throw new Error("The order has no Stripe payment to refund.");
    const refund = await getStripe().refunds.create(
      {
        payment_intent: order.paymentIntent,
        amount: claimed.refundCents, // a partial refund: only what this return is worth
        reason: "requested_by_customer",
        metadata: { returnId: claimed.id, orderId: claimed.orderId },
      },
      // Stripe remembers this key: retrying after a crash returns the SAME refund instead of paying twice.
      { idempotencyKey: `refund-for-return-${claimed.id}` },
    );
    const finished = await recordRefund(refund);
    if (finished) await sendRefundEmail(finished); // already running after the response, so just send it
  } catch (error) {
    console.error(`Could not send the refund for return ${claimed.id}:`, error);
    // Release the claim, so the next page visit tries again.
    await db.update(returns).set({ refundStatus: null }).where(and(eq(returns.id, claimed.id), eq(returns.refundStatus, "processing")));
  }
}

// Saves what Stripe says about a refund. Called right after creating it, and again from the webhook
// whenever Stripe reports a change (refund.created / refund.updated / refund.failed).
// Returns the return's id if THIS call is the one that marked the refund as succeeded (so the
// caller sends the "money is on its way" email exactly once), otherwise null.
export async function recordRefund(refund: Stripe.Refund): Promise<string | null> {
  const returnId = refund.metadata?.returnId;
  if (!returnId || !/^[0-9a-f-]{36}$/i.test(returnId)) return null; // not one of our return refunds
  const status = refund.status ?? "pending";

  const [current] = await db.select().from(returns).where(eq(returns.id, returnId));
  if (!current) return null;
  // Webhooks can arrive out of order. Never move a finished refund back to an unfinished state.
  if (current.refundStatus && FINAL.includes(current.refundStatus) && !FINAL.includes(status)) return null;
  if (current.refundStatus === status && current.stripeRefundId === refund.id) return null;

  const [changed] = await db
    .update(returns)
    .set({
      stripeRefundId: refund.id,
      refundStatus: status,
      refundFailure: refund.failure_reason ?? null,
      refundedAt: status === "succeeded" ? (current.refundedAt ?? new Date()) : current.refundedAt,
    })
    // Only if nobody changed it in between (compare-and-set), so the email below goes out exactly once.
    .where(and(eq(returns.id, returnId), current.refundStatus === null ? isNull(returns.refundStatus) : eq(returns.refundStatus, current.refundStatus)))
    .returning();

  return changed && status === "succeeded" && current.refundStatus !== "succeeded" ? returnId : null;
}

export async function sendRefundEmail(returnId: string): Promise<void> {
  try {
    const ret = await getReturn(returnId);
    if (!ret) return;
    const [order] = await db.select({ email: orders.email }).from(orders).where(eq(orders.id, ret.orderId));
    if (!order?.email || !process.env.SITE_URL) return;
    await sendEmail({ to: order.email, ...refundSentEmail(ret, process.env.SITE_URL) });
  } catch (error) {
    console.error(`Could not send the refund email for return ${returnId}:`, error);
  }
}

// For the receipt: the refunds that went through (or are on their way) for these orders.
export async function refundsForOrders(orderIds: string[]) {
  if (orderIds.length === 0) return [];
  return db
    .select({ orderId: returns.orderId, returnCode: returns.returnCode, refundCents: returns.refundCents, refundStatus: returns.refundStatus, refundedAt: returns.refundedAt })
    .from(returns)
    .where(and(inArray(returns.orderId, orderIds), inArray(returns.refundStatus, ["pending", "requires_action", "succeeded"])));
}
