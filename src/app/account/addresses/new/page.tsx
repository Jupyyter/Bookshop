import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { AddressForm } from "@/components/address-form";
import { COUNTIES } from "@/lib/romania";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Add an address" };

export default function NewAddressPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-12 font-sans">
      <Link href="/account/addresses" className="text-sm text-zinc-500 hover:underline">
        ← Your addresses
      </Link>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">Add an address</h1>
      <Suspense fallback={null}>
        <SignedInForm />
      </Suspense>
    </main>
  );
}

async function SignedInForm() {
  await connection();
  await requireUser("/account/addresses/new");
  return <AddressForm counties={COUNTIES} />;
}
