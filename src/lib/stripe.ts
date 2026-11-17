import Stripe from "stripe";

let stripe: Stripe | null = null;

// Created on first use, not when the file loads, so `npm run build` works without the key.
export function getStripe(): Stripe {
  if (!stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY is not set. Add it to .env.local.");
    // This is a public demo shop: refuse live keys, so it can never charge a real card.
    if (!key.startsWith("sk_test_") && !key.startsWith("rk_test_")) {
      throw new Error("Use a Stripe test-mode key (it starts with sk_test_).");
    }
    stripe = new Stripe(key);
  }
  return stripe;
}