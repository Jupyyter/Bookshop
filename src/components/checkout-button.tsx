"use client";

import Link from "next/link";
import { useActionState } from "react";
import { startCheckout } from "@/app/actions/checkout";

export type AddressOption = { id: string; title: string; summary: string };

// The checkout button, plus (when signed in) the choice of where to deliver.
export function CheckoutButton({ addresses, defaultAddressId }: { addresses?: AddressOption[]; defaultAddressId?: string }) {
  // On success startCheckout never comes back: the server redirects the browser to Stripe.
  const [state, action, pending] = useActionState<{ error: string } | null, FormData>(
    (_previous, form) => startCheckout(form),
    null,
  );

  return (
    <form action={action} className="mt-6">
      {addresses && (
        <fieldset className="mb-6">
          <legend className="font-semibold">Deliver to</legend>
          <div className="mt-3 space-y-2">
            {addresses.map((address) => (
              <label key={address.id} className="flex cursor-pointer gap-3 rounded-lg border border-zinc-200 p-3 has-checked:border-zinc-900 dark:border-zinc-800 dark:has-checked:border-zinc-300">
                <input type="radio" name="addressId" value={address.id} defaultChecked={address.id === defaultAddressId} className="mt-1" />
                <span>
                  <span className="block font-medium">{address.title}</span>
                  <span className="block text-sm text-zinc-500">{address.summary}</span>
                </span>
              </label>
            ))}
            <label className="flex cursor-pointer gap-3 rounded-lg border border-zinc-200 p-3 has-checked:border-zinc-900 dark:border-zinc-800 dark:has-checked:border-zinc-300">
              <input type="radio" name="addressId" value="new" defaultChecked={!defaultAddressId} className="mt-1" />
              <span>
                <span className="block font-medium">A new address</span>
                <span className="block text-sm text-zinc-500">Type it on the payment page. It&apos;s saved to your account afterwards.</span>
              </span>
            </label>
          </div>
          <Link href="/account/addresses" className="mt-2 inline-block text-sm underline">
            Manage addresses
          </Link>
        </fieldset>
      )}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-zinc-900 px-6 py-3 font-medium text-white transition hover:bg-zinc-700 disabled:opacity-60 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        {pending ? "Opening the payment page…" : "Checkout"}
      </button>
      {state?.error && (
        <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-400">
          {state.error}
        </p>
      )}
    </form>
  );
}
