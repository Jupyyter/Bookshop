"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { setWishlisted } from "@/app/actions/wishlist";

const buttonClass =
  "inline-flex items-center gap-2 rounded-lg border border-zinc-300 px-4 py-3 font-medium transition hover:bg-zinc-100 disabled:opacity-60 dark:border-zinc-700 dark:hover:bg-zinc-900";

export function WishlistButton({ bookId, initiallySaved, signedIn }: { bookId: string; initiallySaved: boolean; signedIn: boolean }) {
  const [saved, setSaved] = useState(initiallySaved);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // The wishlist belongs to an account, so guests are sent to sign in (and brought back here).
  if (!signedIn) {
    return (
      <Link href={`/sign-in?next=${encodeURIComponent(`/books/${bookId}`)}`} className={buttonClass}>
        <Heart filled={false} /> Save
      </Link>
    );
  }

  function toggle() {
    const wanted = !saved;
    setSaved(wanted); // show the change at once ("optimistic"); undo it below if the server says no
    setMessage(null);
    startTransition(async () => {
      try {
        const result = await setWishlisted(bookId, wanted);
        if ("saved" in result) setSaved(result.saved);
        else {
          setSaved(!wanted);
          setMessage("error" in result ? result.error : "Sign in to save books.");
        }
      } catch {
        setSaved(!wanted);
        setMessage("Could not reach the server. Try again.");
      }
    });
  }

  return (
    <span className="inline-flex flex-col">
      <button type="button" onClick={toggle} disabled={pending} aria-pressed={saved} className={buttonClass}>
        <Heart filled={saved} /> {saved ? "Saved" : "Save"}
      </button>
      {message && (
        <span role="alert" className="mt-1 text-sm text-red-600 dark:text-red-400">
          {message}
        </span>
      )}
    </span>
  );
}

function Heart({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className={`h-5 w-5 ${filled ? "fill-red-500 stroke-red-500" : "fill-none stroke-current"}`} strokeWidth={2} aria-hidden="true">
      <path d="M12 21s-7.5-4.6-10-9.3C.3 8.4 2.2 4 6.3 4c2.3 0 3.8 1.4 5.7 3.5C13.9 5.4 15.4 4 17.7 4c4.1 0 6 4.4 4.3 7.7C19.5 16.4 12 21 12 21z" />
    </svg>
  );
}
