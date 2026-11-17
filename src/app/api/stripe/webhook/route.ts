import type Stripe from "stripe";
import { after } from "next/server";
import { expireCheckout, fulfillCheckout } from "@/lib/orders";
import { recordRefund, sendRefundEmail } from "@/lib/returns";
import { getStripe } from "@/lib/stripe";

// Stripe calls this URL (POST /api/stripe/webhook) when something happens to a payment.
export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!signature || !secret) return new Response("Missing signature", { status: 400 });

  // The signature covers the exact bytes Stripe sent, so read the raw text, not parsed JSON.
  const body = await request.text();

  let event: Stripe.Event;
  try {
    // Proves the request really came from Stripe. Without this, anyone could POST "paid!" here.
    event = getStripe().webhooks.constructEvent(body, signature, secret);
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded":
      await fulfillCheckout(event.data.object.id);
      break;
    case "checkout.session.expired":
      await expireCheckout(event.data.object.id);
      break;
    // A refund we asked for changed: usually pending → succeeded within seconds, rarely failed.
    case "refund.created":
    case "refund.updated":
    case "refund.failed": {
      const finished = await recordRefund(event.data.object);
      if (finished) after(() => sendRefundEmail(finished)); // email after answering Stripe
      break;
    }
    // Every other event type is ignored, but still answered with 200 so Stripe doesn't retry it.
  }

  return new Response(null, { status: 200 });
}
