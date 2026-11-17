import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { AddressForm } from "@/components/address-form";
import { findAddress } from "@/lib/addresses";
import { COUNTIES } from "@/lib/romania";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Edit address" };

type Params = PageProps<"/account/addresses/[id]">["params"];

export default function EditAddressPage({ params }: PageProps<"/account/addresses/[id]">) {
  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-12 font-sans">
      <Link href="/account/addresses" className="text-sm text-zinc-500 hover:underline">
        ← Your addresses
      </Link>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">Edit address</h1>
      <Suspense fallback={null}>
        <EditForm params={params} />
      </Suspense>
    </main>
  );
}

async function EditForm({ params }: { params: Params }) {
  await connection();
  const { id } = await params;
  const user = await requireUser(`/account/addresses/${id}`);
  const address = await findAddress(user.id, id); // only finds addresses of this account
  if (!address) notFound();

  // Hand the form only what it shows (the client never needs our timestamps or user ids).
  const { id: addressId, label, fullName, phone, line1, line2, city, county, postalCode, isDefault } = address;
  return (
    <AddressForm
      address={{ id: addressId, label, fullName, phone, line1, line2, city, county, postalCode, isDefault }}
      counties={COUNTIES}
    />
  );
}
