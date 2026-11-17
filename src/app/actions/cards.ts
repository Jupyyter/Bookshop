"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { CURRENCY } from "@/lib/pricing";
import { findStripeCustomerId, getOrCreateStripeCustomerId } from "@/lib/saved-cards";
import { getCurrentUser } from "@/lib/session";
import { getStripe } from "@/lib/stripe";

const CARD_ID = /^pm_[A-Za-z0-9]+$/;

// Opens a Stripe page that only saves a card (Checkout in "setup" mode: nothing is charged).
export async function addCard(): Promise<{ error: string }> {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in?next=/account/cards");
  const siteUrl = process.env.SITE_URL;
  if (!siteUrl) throw new Error("SITE_URL is not set. Add it to .env.local.");

  let url: string | null;
  try {
    const session = await getStripe().checkout.sessions.create({
      mode: "setup",
      customer: await getOrCreateStripeCustomerId(user),
      currency: CURRENCY,
      allowed_payment_method_types: ["card"],
      success_url: `${siteUrl}/account/cards?saved=1`,
      cancel_url: `${siteUrl}/account/cards`,
    });
    url = session.url;
  } catch (error) {
    console.error("Could not open Stripe's add-card page:", error);
    return { error: "Could not open the card page. Try again in a minute." };
  }
  if (!url) return { error: "Could not open the card page. Try again in a minute." };
  redirect(url); // outside try/catch, because redirect() works by throwing
}

export async function removeCard(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in?next=/account/cards");

  const cardId = String(formData.get("cardId") ?? "");
  if (!CARD_ID.test(cardId)) return;

  // The card ID came from the browser, so it could be anyone's. Only remove it if it belongs to
  // THIS account's Stripe customer.
  const customerId = await findStripeCustomerId(user.id);
  if (!customerId) return;
  try {
    const card = await getStripe().paymentMethods.retrieve(cardId);
    const owner = typeof card.customer === "string" ? card.customer : card.customer?.id;
    if (owner !== customerId) return;
    await getStripe().paymentMethods.detach(cardId);
  } catch (error) {
    console.error("Could not remove the card:", error); // e.g. it was already removed in another tab
  }
  refresh();
}
