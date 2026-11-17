import { and, asc, desc, eq } from "drizzle-orm";
import type Stripe from "stripe";
import { db } from "@/db";
import { type Address, addresses, MAX_ADDRESSES } from "@/db/schema";
import { countyCode, countyName } from "@/lib/romania";

// The account's address book: reading, checking what someone typed, and turning an address into
// the shape Stripe uses.

export async function listAddresses(userId: string): Promise<Address[]> {
  return db
    .select()
    .from(addresses)
    .where(eq(addresses.userId, userId))
    .orderBy(desc(addresses.isDefault), asc(addresses.createdAt));
}

// Always look an address up together with its owner, so an ID from the browser can't reach someone else's.
export async function findAddress(userId: string, addressId: string): Promise<Address | null> {
  if (!UUID.test(addressId)) return null;
  const [address] = await db
    .select()
    .from(addresses)
    .where(and(eq(addresses.id, addressId), eq(addresses.userId, userId)));
  return address ?? null;
}

export function addressLines(address: Address): string[] {
  return [
    address.line1,
    address.line2,
    `${address.postalCode} ${address.city}`,
    address.county === "B" ? null : `${countyName(address.county)} county`,
  ].filter((line): line is string => Boolean(line));
}

// For Stripe: putting this on the Stripe customer makes the payment page start with it filled in.
export function toStripeShipping(address: Address): Stripe.CustomerUpdateParams.Shipping {
  return {
    name: address.fullName,
    phone: address.phone ?? undefined,
    address: {
      line1: address.line1,
      line2: address.line2 ?? undefined,
      city: address.city,
      state: address.county,
      postal_code: address.postalCode,
      country: address.country,
    },
  };
}

// ---------- checking the form ----------

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type AddressInput = {
  label: string | null;
  fullName: string;
  phone: string | null;
  line1: string;
  line2: string | null;
  city: string;
  county: string;
  postalCode: string;
};
export type AddressErrors = Partial<Record<keyof AddressInput, string>>;

// Everything that comes from a form is just text the browser sent, so every field is checked here
// on the server (the "required" in the HTML only helps honest visitors).
export function parseAddressForm(form: FormData): { data: AddressInput } | { errors: AddressErrors; values: Record<string, string> } {
  const get = (name: string) => String(form.get(name) ?? "").trim().replace(/\s+/g, " ");
  const values = Object.fromEntries(
    ["label", "fullName", "phone", "line1", "line2", "city", "county", "postalCode"].map((name) => [name, get(name)]),
  );
  const errors: AddressErrors = {};

  if (values.label.length > 40) errors.label = "Keep the label under 40 characters.";
  if (values.fullName.length < 2 || values.fullName.length > 100) errors.fullName = "Enter the name of the person receiving the parcel.";
  const phone = values.phone.replace(/[\s().-]/g, "");
  if (phone && !/^\+?\d{9,15}$/.test(phone)) errors.phone = "Enter a phone number like 0712 345 678.";
  if (values.line1.length < 3 || values.line1.length > 200) errors.line1 = "Enter the street and number.";
  if (values.line2.length > 200) errors.line2 = "This line is too long.";
  if (values.city.length < 2 || values.city.length > 100) errors.city = "Enter the town or city.";
  const county = countyCode(values.county);
  if (!county) errors.county = "Choose a county.";
  if (!/^\d{6}$/.test(values.postalCode)) errors.postalCode = "Romanian postal codes have 6 digits.";

  if (Object.keys(errors).length > 0) return { errors, values };
  return {
    data: {
      label: values.label || null,
      fullName: values.fullName,
      phone: phone || null,
      line1: values.line1,
      line2: values.line2 || null,
      city: values.city,
      county: county!,
      postalCode: values.postalCode,
    },
  };
}

// ---------- remembering the address of an order ----------

// Lowercase, without diacritics, spaces or punctuation: "Bd. Revoluției 5" → "bdrevolutiei5".
function simplify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

// Called when a signed-in customer's order is paid: if the address they typed on Stripe's page isn't
// in their address book yet, add it, so next time it's already there. (The first one becomes the default.)
export async function rememberAddress(tx: Tx, userId: string, name: string | null | undefined, address: Stripe.Address | null | undefined) {
  const county = countyCode(address?.state);
  if (!address?.line1 || !address.city || !address.postal_code || !county || !name) return;

  const saved = await tx
    .select({ line1: addresses.line1, city: addresses.city, postalCode: addresses.postalCode })
    .from(addresses)
    .where(eq(addresses.userId, userId));
  if (saved.length >= MAX_ADDRESSES) return;

  // Same street, town and postal code counts as already saved, however it was typed:
  // "Bd. Revoluției 5, Timișoara" and "bd revolutiei 5, TIMISOARA" are the same place.
  const key = (line1: string, city: string, postalCode: string) => [line1, city, postalCode].map(simplify).join("|");
  const newKey = key(address.line1, address.city, address.postal_code);
  if (saved.some((a) => key(a.line1, a.city, a.postalCode) === newKey)) return;

  await tx.insert(addresses).values({
    userId,
    fullName: name,
    line1: address.line1,
    line2: address.line2 || null,
    city: address.city,
    county,
    postalCode: address.postal_code,
    country: address.country ?? "RO",
    isDefault: saved.length === 0,
  });
}
