"use client"; // this component runs in the browser, because it reacts to clicks

import { useState, useTransition } from "react";
import { addToCart } from "@/app/actions/cart";

export function AddToCartButton({ bookId }: { bookId: string }) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function handleClick() {
    startTransition(async () => {
      try {
        const result = await addToCart(bookId); // runs on the server, like a remote function call
        setMessage(result.message);
      } catch {
        setMessage("Could not reach the server. Try again.");
      }
    });
  }

  return (
    <div className="mt-4 flex flex-wrap items-center gap-4">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className="rounded-lg bg-zinc-900 px-6 py-3 font-medium text-white transition hover:bg-zinc-700 disabled:opacity-60 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        {isPending ? "Adding…" : "Add to cart"}
      </button>
      {message && (
        <p role="status" className="text-sm text-zinc-500">
          {message}
        </p>
      )}
    </div>
  );
}