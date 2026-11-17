import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { removeCard } from "@/app/actions/cards";
import { AddCardButton } from "@/components/account-buttons";
import { listSavedCards } from "@/lib/saved-cards";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Saved cards" };

type SearchParams = PageProps<"/account/cards">["searchParams"];

export default function CardsPage({ searchParams }: PageProps<"/account/cards">) {
  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-12 font-sans">
      <Link href="/account" className="text-sm text-zinc-500 hover:underline">
        ← Your account
      </Link>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">Saved cards</h1>
      <p className="mt-2 text-zinc-500">
        Cards you saved are offered on the payment page, so you don&apos;t type them again. They&apos;re kept by Stripe,
        our payment provider: Bookshop never sees or stores your full card number.
      </p>
      <Suspense fallback={<p className="mt-8 text-zinc-500">Loading your cards…</p>}>
        <CardList searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function CardList({ searchParams }: { searchParams: SearchParams }) {
  await connection();
  const user = await requireUser("/account/cards");
  const [cards, { saved }] = await Promise.all([listSavedCards(user.id), searchParams]);

  return (
    <>
      {saved && (
        <p role="status" className="mt-6 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-800 dark:bg-green-950 dark:text-green-300">
          Card saved.
        </p>
      )}
      {cards.length === 0 ? (
        <p className="mt-8 text-zinc-500">
          No saved cards yet. Next time you pay, tick the box to save your card on the payment page, or add one here.
        </p>
      ) : (
        <ul className="mt-8 divide-y divide-zinc-200 dark:divide-zinc-800">
          {cards.map((card) => (
            <li key={card.id} className="flex items-center justify-between gap-4 py-4">
              <div>
                <p className="font-medium capitalize">
                  {card.brand} <span className="font-mono">•••• {card.last4}</span>
                </p>
                <p className="text-sm text-zinc-500">
                  Expires {String(card.expMonth).padStart(2, "0")}/{String(card.expYear).slice(-2)}
                </p>
              </div>
              <form action={removeCard}>
                <input type="hidden" name="cardId" value={card.id} />
                <button className="text-sm text-zinc-500 underline hover:text-zinc-900 dark:hover:text-zinc-100">Remove</button>
              </form>
            </li>
          ))}
        </ul>
      )}
      <AddCardButton />
    </>
  );
}
