"use client";

import { useActionState } from "react";
import { addCard } from "@/app/actions/cards";

export function AddCardButton() {
  // On success addCard() never returns: the server sends the browser to Stripe's card page.
  const [state, action, pending] = useActionState<{ error: string } | null>(() => addCard(), null);
  return (
    <form action={action} className="mt-6">
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-zinc-900 px-5 py-2.5 font-medium text-white hover:bg-zinc-700 disabled:opacity-60 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        {pending ? "Opening Stripe…" : "Add a card"}
      </button>
      {state?.error && (
        <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-400">
          {state.error}
        </p>
      )}
    </form>
  );
}
