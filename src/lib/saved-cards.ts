import { eq } from "drizzle-orm";
import { db } from "@/db";
import { stripeCustomers } from "@/db/schema";
import type { User } from "@/lib/auth";
import { getStripe } from "@/lib/stripe";

// Saved cards live at Stripe, never in our database. Card numbers are something we must not store
// (that would bring heavy security rules, called PCI DSS, onto the shop). Stripe keeps them on a
// "customer" object; we only keep the customer's ID next to the account.

export async function findStripeCustomerId(userId: string): Promise<string | null> {
  const [row] = await db
    .select({ id: stripeCustomers.stripeCustomerId })
    .from(stripeCustomers)
    .where(eq(stripeCustomers.userId, userId));
  return row?.id ?? null;
}

export async function getOrCreateStripeCustomerId(user: User): Promise<string> {
  const existing = await findStripeCustomerId(user.id);
  if (existing) return existing;

  // The idempotency key makes Stripe return the SAME customer if two requests race to create one.
  const customer = await getStripe().customers.create(
    { email: user.email, name: user.name, metadata: { userId: user.id } },
    { idempotencyKey: `customer-for-${user.id}` },
  );
  await db.insert(stripeCustomers).values({ userId: user.id, stripeCustomerId: customer.id }).onConflictDoNothing();
  return (await findStripeCustomerId(user.id)) ?? customer.id;
}

export type SavedCard = { id: string; brand: string; last4: string; expMonth: number; expYear: number };

// The cards this account chose to keep. ("allow_redisplay: always" is Stripe's word for
// "the customer agreed to see this card again"; those are exactly the ones Checkout offers.)
export async function listSavedCards(userId: string): Promise<SavedCard[]> {
  const customerId = await findStripeCustomerId(userId);
  if (!customerId) return [];

  const { data } = await getStripe().customers.listPaymentMethods(customerId, { type: "card", limit: 20 });
  return data
    .filter((method) => method.allow_redisplay === "always" && method.card)
    .map((method) => ({
      id: method.id,
      brand: method.card!.brand,
      last4: method.card!.last4,
      expMonth: method.card!.exp_month,
      expYear: method.card!.exp_year,
    }));
}
