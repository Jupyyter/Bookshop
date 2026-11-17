"use server";

import { and, count, desc, eq, ne } from "drizzle-orm";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { addresses, MAX_ADDRESSES } from "@/db/schema";
import { type AddressErrors, parseAddressForm, UUID } from "@/lib/addresses";
import { getCurrentUser } from "@/lib/session";

export type AddressFormState = { errors?: AddressErrors; values?: Record<string, string>; error?: string } | null;

// Adds a new address, or changes an existing one when the form includes its id.
export async function saveAddress(_previous: AddressFormState, form: FormData): Promise<AddressFormState> {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in?next=/account/addresses");

  const parsed = parseAddressForm(form);
  if ("errors" in parsed) return parsed;

  const id = String(form.get("id") ?? "");
  const wantsDefault = form.get("isDefault") === "on";

  const result = await db.transaction(async (tx) => {
    const [{ total }] = await tx.select({ total: count() }).from(addresses).where(eq(addresses.userId, user.id));

    let addressId: string;
    if (id) {
      // "AND user_id = …": the id came from the browser, so only ever touch this account's own address.
      if (!UUID.test(id)) return "not-found";
      const [updated] = await tx
        .update(addresses)
        .set({ ...parsed.data, updatedAt: new Date() })
        .where(and(eq(addresses.id, id), eq(addresses.userId, user.id)))
        .returning({ id: addresses.id });
      if (!updated) return "not-found";
      addressId = updated.id;
    } else {
      if (total >= MAX_ADDRESSES) return "full";
      const [created] = await tx
        .insert(addresses)
        .values({ ...parsed.data, userId: user.id })
        .returning({ id: addresses.id });
      addressId = created.id;
    }

    // The first address is the default automatically; otherwise only when the box was ticked.
    if (wantsDefault || total === 0) await makeDefault(tx, user.id, addressId);
    return "saved";
  });

  if (result === "full") return { error: `You can save up to ${MAX_ADDRESSES} addresses. Delete one first.` };
  if (result === "not-found") return { error: "This address doesn't exist anymore." };
  redirect("/account/addresses");
}

export async function deleteAddress(form: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in?next=/account/addresses");
  const id = String(form.get("id") ?? "");
  if (!UUID.test(id)) return;

  await db.transaction(async (tx) => {
    const [deleted] = await tx
      .delete(addresses)
      .where(and(eq(addresses.id, id), eq(addresses.userId, user.id)))
      .returning({ wasDefault: addresses.isDefault });
    // Deleting the default address: the newest remaining one takes its place.
    if (deleted?.wasDefault) {
      const [next] = await tx
        .select({ id: addresses.id })
        .from(addresses)
        .where(eq(addresses.userId, user.id))
        .orderBy(desc(addresses.createdAt))
        .limit(1);
      if (next) await makeDefault(tx, user.id, next.id);
    }
  });
  refresh();
}

export async function setDefaultAddress(form: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in?next=/account/addresses");
  const id = String(form.get("id") ?? "");
  if (!UUID.test(id)) return;
  await db.transaction((tx) => makeDefault(tx, user.id, id));
  refresh();
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

// Two steps in one transaction: un-default the others, then default this one.
// (The database refuses two defaults at once, thanks to the unique index in schema.ts.)
async function makeDefault(tx: Tx, userId: string, addressId: string) {
  await tx
    .update(addresses)
    .set({ isDefault: false })
    .where(and(eq(addresses.userId, userId), eq(addresses.isDefault, true), ne(addresses.id, addressId)));
  await tx
    .update(addresses)
    .set({ isDefault: true })
    .where(and(eq(addresses.id, addressId), eq(addresses.userId, userId)));
}
