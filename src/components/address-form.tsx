"use client";

import Link from "next/link";
import { startTransition, useActionState } from "react";
import { type AddressFormState, saveAddress } from "@/app/actions/addresses";

type AddressValues = {
  id: string;
  label: string | null;
  fullName: string;
  phone: string | null;
  line1: string;
  line2: string | null;
  city: string;
  county: string;
  postalCode: string;
  isDefault: boolean;
};

const inputClass =
  "mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 outline-none focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:border-zinc-300";

type FieldProps = {
  name: keyof AddressValues;
  label: string;
  defaultValue: string;
  error?: string;
  autoComplete?: string;
  required?: boolean;
  inputMode?: "numeric" | "tel";
  hint?: string;
};

function Field({ name, label, defaultValue, error, hint, ...input }: FieldProps) {
  return (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      <input name={name} defaultValue={defaultValue} aria-invalid={Boolean(error)} className={inputClass} {...input} />
      {hint && !error && <span className="mt-1 block text-xs text-zinc-500">{hint}</span>}
      {error && <span className="mt-1 block text-sm text-red-600 dark:text-red-400">{error}</span>}
    </label>
  );
}

export function AddressForm({ address, counties }: { address?: AddressValues; counties: { code: string; name: string }[] }) {
  const [state, action, pending] = useActionState<AddressFormState, FormData>(saveAddress, null);

  // After a failed save, show what was typed (state.values); otherwise the saved address, if editing.
  const value = (name: keyof AddressValues) => state?.values?.[name] ?? (address?.[name] as string | null | undefined) ?? "";
  // Everything a text field needs: its name, what to show in it, and its error message (if any).
  const field = (name: keyof AddressValues & keyof NonNullable<NonNullable<AddressFormState>["errors"]>) => ({
    name,
    defaultValue: value(name),
    error: state?.errors?.[name],
  });

  // Submitting through onSubmit (instead of <form action>) stops React from clearing the form
  // afterwards, so after a mistake everything typed, including the county, is still there.
  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    startTransition(() => action(form));
  }

  return (
    <form onSubmit={submit} className="mt-8 max-w-lg space-y-4">
      {address && <input type="hidden" name="id" value={address.id} />}
      <Field {...field("label")} label="Label (optional)" hint="Like “Home” or “Work”." />
      <Field {...field("fullName")} label="Full name" autoComplete="name" required />
      <Field {...field("phone")} label="Phone (optional, for the courier)" autoComplete="tel" inputMode="tel" />
      <Field {...field("line1")} label="Street and number" autoComplete="address-line1" required />
      <Field {...field("line2")} label="Block, staircase, flat (optional)" autoComplete="address-line2" />
      <div className="grid grid-cols-2 gap-4">
        <Field {...field("city")} label="Town or city" autoComplete="address-level2" required />
        <Field {...field("postalCode")} label="Postal code" autoComplete="postal-code" inputMode="numeric" required />
      </div>
      <label className="block">
        <span className="text-sm font-medium">County</span>
        <select name="county" defaultValue={value("county")} required className={inputClass}>
          <option value="" disabled>
            Choose…
          </option>
          {counties.map((county) => (
            <option key={county.code} value={county.code}>
              {county.name}
            </option>
          ))}
        </select>
        {state?.errors?.county && <span className="mt-1 block text-sm text-red-600 dark:text-red-400">{state.errors.county}</span>}
      </label>
      <label className="flex items-center gap-2">
        <input type="checkbox" name="isDefault" defaultChecked={address?.isDefault} className="h-4 w-4" />
        <span className="text-sm">Use as my default delivery address</span>
      </label>

      {state?.error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {state.error}
        </p>
      )}
      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-zinc-900 px-6 py-3 font-medium text-white hover:bg-zinc-700 disabled:opacity-60 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {pending ? "Saving…" : "Save address"}
        </button>
        <Link href="/account/addresses" className="text-zinc-500 underline">
          Cancel
        </Link>
      </div>
    </form>
  );
}
