import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { deleteAddress, setDefaultAddress } from "@/app/actions/addresses";
import { MAX_ADDRESSES } from "@/db/schema";
import { addressLines, listAddresses } from "@/lib/addresses";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Your addresses" };

export default function AddressesPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-12 font-sans">
      <Link href="/account" className="text-sm text-zinc-500 hover:underline">
        ← Your account
      </Link>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">Your addresses</h1>
      <p className="mt-2 text-zinc-500">
        Your default address is filled in on the payment page. Addresses you use for an order are saved here automatically.
      </p>
      <Suspense fallback={<p className="mt-8 text-zinc-500">Loading your addresses…</p>}>
        <AddressList />
      </Suspense>
    </main>
  );
}

async function AddressList() {
  await connection();
  const user = await requireUser("/account/addresses");
  const list = await listAddresses(user.id);

  return (
    <>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {list.map((address) => (
          <div key={address.id} className="flex flex-col rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
            <div className="flex items-center gap-2">
              <p className="font-semibold">{address.label ?? address.fullName}</p>
              {address.isDefault && (
                <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-xs text-white dark:bg-white dark:text-zinc-900">Default</span>
              )}
            </div>
            <p className="mt-2 flex-1 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
              {address.label && (
                <>
                  {address.fullName}
                  <br />
                </>
              )}
              {addressLines(address).map((line) => (
                <span key={line} className="block">
                  {line}
                </span>
              ))}
              {address.phone && <span className="block">{address.phone}</span>}
            </p>
            <div className="mt-4 flex flex-wrap gap-4 text-sm">
              <Link href={`/account/addresses/${address.id}`} className="underline">
                Edit
              </Link>
              {!address.isDefault && (
                <form action={setDefaultAddress}>
                  <input type="hidden" name="id" value={address.id} />
                  <button className="underline">Make default</button>
                </form>
              )}
              <form action={deleteAddress}>
                <input type="hidden" name="id" value={address.id} />
                <button className="text-zinc-500 underline hover:text-zinc-900 dark:hover:text-zinc-100">Delete</button>
              </form>
            </div>
          </div>
        ))}
      </div>
      {list.length === 0 && <p className="text-zinc-500">No saved addresses yet.</p>}
      {list.length < MAX_ADDRESSES && (
        <Link
          href="/account/addresses/new"
          className="mt-6 inline-block rounded-lg bg-zinc-900 px-5 py-2.5 font-medium text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          Add an address
        </Link>
      )}
    </>
  );
}
