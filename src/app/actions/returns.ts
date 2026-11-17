"use server";

import { randomInt } from "node:crypto";
import { eq } from "drizzle-orm";
import { after } from "next/server";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { orders, returnItems, returns } from "@/db/schema";
import { returnStartedEmail } from "@/emails/returns";
import { sendEmail } from "@/lib/email";
import { getOrderDetails } from "@/lib/orders";
import { planReturnTrip, RETURN_REASONS, type ReturnReason, refundFor } from "@/lib/return-rules";
import { getReturn, ownsOrder, returnableLines, returnWindow } from "@/lib/returns";
import { getCurrentUser } from "@/lib/session";

export type StartReturnState = { error: string } | null;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Everything in the form is checked again here: the browser only shows the form, the server decides.
export async function startReturn(_previous: StartReturnState, form: FormData): Promise<StartReturnState> {
  const orderId = String(form.get("orderId") ?? "");
  if (!UUID.test(orderId)) return { error: "This order doesn't exist." };

  const user = await getCurrentUser();
  if (!user) redirect(`/sign-in?next=${encodeURIComponent(`/orders/${orderId}/return`)}`);

  const order = await getOrderDetails(orderId);
  if (!order || order.status !== "paid" || !ownsOrder(user, order)) return { error: "This order doesn't exist." };
  const timing = returnWindow(order);
  if (!timing.ok) {
    return { error: timing.why === "too-late" ? "The 30-day return window for this order has closed." : "You can return books once they've been delivered." };
  }

  const reason = String(form.get("reason") ?? "") as ReturnReason;
  if (!RETURN_REASONS.includes(reason)) return { error: "Choose why you're returning the books." };
  const note = String(form.get("note") ?? "").trim();
  if (note.length > 500) return { error: "Keep the note under 500 characters." };

  const result = await db.transaction(async (tx): Promise<{ error: string } | { id: string }> => {
    // Lock the order row: two returns submitted at the same moment (two tabs, a double click) wait
    // for each other here, so together they can never return more copies than were bought.
    await tx.select({ id: orders.id }).from(orders).where(eq(orders.id, orderId)).for("update");

    const lines = await returnableLines(orderId, tx);
    const chosen: { bookId: string; title: string; unitPriceCents: number; quantity: number }[] = [];
    for (const line of lines) {
      const wanted = Number(form.get(`qty-${line.bookId}`) ?? 0);
      if (!Number.isInteger(wanted) || wanted < 0 || wanted > line.left) return { error: "Some of these copies are already being returned. Reload the page to see what's left." };
      if (wanted > 0) chosen.push({ bookId: line.bookId, title: line.title, unitPriceCents: line.unitPriceCents, quantity: wanted });
    }
    if (chosen.length === 0) return { error: "Choose at least one book to return." };

    const leftBefore = lines.reduce((sum, line) => sum + line.left, 0);
    const returning = chosen.reduce((sum, line) => sum + line.quantity, 0);
    const refund = refundFor({ lines: chosen, reason, returnsEverythingLeft: returning === leftBefore, shippingCents: order.shippingCents ?? 0 });

    const startedAt = new Date();
    const [created] = await tx
      .insert(returns)
      .values({
        orderId,
        userId: user.id,
        reason,
        note: note || null,
        returnCode: makeReturnCode(),
        refundCents: refund.totalCents,
        includesShipping: refund.shippingCents > 0,
        createdAt: startedAt,
        ...planReturnTrip(startedAt),
      })
      .returning({ id: returns.id });
    await tx.insert(returnItems).values(chosen.map((line) => ({ ...line, returnId: created.id })));
    return { id: created.id };
  });

  if ("error" in result) return { error: result.error };

  after(async () => {
    try {
      const ret = await getReturn(result.id);
      if (ret && order.email && process.env.SITE_URL) await sendEmail({ to: order.email, ...returnStartedEmail(ret, process.env.SITE_URL) });
    } catch (error) {
      console.error("Could not send the return email:", error);
    }
  });
  redirect(`/account/returns/${result.id}`);
}

// "RT-" and 6 characters that can't be confused when written by hand (no 0/O, 1/I).
function makeReturnCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return "RT-" + Array.from({ length: 6 }, () => alphabet.charAt(randomInt(alphabet.length))).join("");
}
