"use client";

import Link from "next/link";
import { startTransition, useActionState, useState } from "react";
import { type StartReturnState, startReturn } from "@/app/actions/returns";
import { formatPrice } from "@/lib/pricing";
import { RETURN_REASON_LABELS, RETURN_REASONS, type ReturnReason, refundFor } from "@/lib/return-rules";

type Line = { bookId: string; title: string; unitPriceCents: number; left: number };

const price = formatPrice; // pricing.ts has no server-only code, so the browser can use it too

export function ReturnForm({ orderId, lines, shippingCents }: { orderId: string; lines: Line[]; shippingCents: number }) {
  const [state, action, pending] = useActionState<StartReturnState, FormData>(startReturn, null);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [reason, setReason] = useState<ReturnReason | "">("");

  // The same rule the server uses (from return-rules.ts), so the amount shown is the amount paid back.
  const chosen = lines.map((line) => ({ ...line, quantity: quantities[line.bookId] ?? 0 })).filter((line) => line.quantity > 0);
  const everything = chosen.reduce((sum, line) => sum + line.quantity, 0) === lines.reduce((sum, line) => sum + line.left, 0);
  const refund = reason ? refundFor({ lines: chosen, reason, returnsEverythingLeft: everything, shippingCents }) : null;

  // onSubmit instead of <form action>, so a mistake doesn't clear what was chosen.
  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    startTransition(() => action(form));
  }

  return (
    <form onSubmit={submit} className="mt-8 space-y-8">
      <input type="hidden" name="orderId" value={orderId} />

      <fieldset>
        <legend className="font-semibold">Which books?</legend>
        <ul className="mt-3 divide-y divide-zinc-200 dark:divide-zinc-800">
          {lines.map((line) => (
            <li key={line.bookId} className="flex items-center justify-between gap-4 py-3">
              <span>
                <span className="block font-medium">{line.title}</span>
                <span className="text-sm text-zinc-500">
                  {price(line.unitPriceCents)} each · {line.left} can be returned
                </span>
              </span>
              <select
                name={`qty-${line.bookId}`}
                value={quantities[line.bookId] ?? 0}
                onChange={(event) => setQuantities({ ...quantities, [line.bookId]: Number(event.target.value) })}
                aria-label={`How many copies of ${line.title} to return`}
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
              >
                {Array.from({ length: line.left + 1 }, (_, n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </li>
          ))}
        </ul>
      </fieldset>

      <fieldset>
        <legend className="font-semibold">Why are you returning them?</legend>
        <div className="mt-3 space-y-2">
          {RETURN_REASONS.map((value) => (
            <label key={value} className="flex items-center gap-3">
              <input type="radio" name="reason" value={value} checked={reason === value} onChange={() => setReason(value)} required />
              {RETURN_REASON_LABELS[value]}
            </label>
          ))}
        </div>
        <label className="mt-4 block">
          <span className="text-sm font-medium">Anything else we should know? (optional)</span>
          <textarea name="note" maxLength={500} rows={3} className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900" />
        </label>
      </fieldset>

      <div className="rounded-xl bg-zinc-100 p-5 dark:bg-zinc-900">
        {refund && chosen.length > 0 ? (
          <>
            <p className="text-lg">
              You&apos;ll get back <strong>{price(refund.totalCents)}</strong>
            </p>
            <p className="mt-1 text-sm text-zinc-500">
              {refund.shippingCents > 0
                ? `That includes the ${price(refund.shippingCents)} you paid for shipping, because the mistake was ours.`
                : "Shipping is refunded when everything comes back because it arrived damaged or was the wrong book."}{" "}
              The money goes back to the card you paid with once the books reach us.
            </p>
          </>
        ) : (
          <p className="text-zinc-500">Choose the books and a reason to see how much you&apos;ll get back.</p>
        )}
      </div>

      {state?.error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {state.error}
        </p>
      )}
      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={pending || chosen.length === 0 || !reason}
          className="rounded-lg bg-zinc-900 px-6 py-3 font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {pending ? "Starting your return…" : "Start return"}
        </button>
        <Link href={`/orders/${orderId}`} className="text-zinc-500 underline">
          Cancel
        </Link>
      </div>
    </form>
  );
}
