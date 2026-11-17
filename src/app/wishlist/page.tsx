import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { moveToCart, removeFromWishlist } from "@/app/actions/wishlist";
import { CompareToggle } from "@/components/compare";
import { formatDate } from "@/lib/dates";
import { coverUrl, getBookDetails } from "@/lib/openlibrary";
import { formatPrice, priceCentsFor } from "@/lib/pricing";
import { requireUser } from "@/lib/session";
import { listWishlist } from "@/lib/wishlist";

export const metadata: Metadata = { title: "Your wishlist" };

export default function WishlistPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-12 font-sans">
      <h1 className="text-3xl font-bold tracking-tight">Your wishlist</h1>
      <Suspense fallback={<p className="mt-8 text-zinc-500">Loading your wishlist…</p>}>
        <Wishlist />
      </Suspense>
    </main>
  );
}

async function Wishlist() {
  const user = await requireUser("/wishlist");
  const saved = await listWishlist(user.id);

  if (saved.length === 0) {
    return (
      <div className="mt-8">
        <p className="text-zinc-500">Nothing saved yet. Press ♡ Save on any book, or &quot;Save for later&quot; in your cart.</p>
        <Link href="/" className="mt-4 inline-block underline">
          Browse books
        </Link>
      </div>
    );
  }

  // Titles, covers and prices are looked up now (from the cache), so they're always current.
  const items = await Promise.all(
    saved.map(async (item) => {
      const result = await getBookDetails(item.bookId);
      return { ...item, book: result.status === "found" ? result.book : null };
    }),
  );

  return (
    <ul className="mt-8 divide-y divide-zinc-200 dark:divide-zinc-800">
      {items.map(({ bookId, addedAt, book }) => (
        <li key={bookId} className="flex gap-4 py-4">
          <Link href={`/books/${bookId}`} className="relative h-28 w-20 shrink-0 overflow-hidden rounded bg-zinc-200 dark:bg-zinc-800">
            {book?.coverId && <Image src={coverUrl(book.coverId)} alt="" fill sizes="80px" className="object-cover" />}
          </Link>
          <div className="flex flex-1 flex-col justify-between gap-2">
            <div>
              <Link href={`/books/${bookId}`} className="font-semibold hover:underline">
                {book?.title ?? "This book is unavailable right now"}
              </Link>
              {book && <p className="text-sm text-zinc-500">{book.authors.join(", ") || "Unknown author"}</p>}
              <p className="text-xs text-zinc-500">Saved {formatDate(addedAt)}</p>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-sm">
              {book && (
                <form action={moveToCart}>
                  <input type="hidden" name="bookId" value={bookId} />
                  <button className="rounded-lg bg-zinc-900 px-3 py-1.5 font-medium text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200">
                    Move to cart
                  </button>
                </form>
              )}
              {book && <CompareToggle bookId={bookId} title={book.title} />}
              <form action={removeFromWishlist}>
                <input type="hidden" name="bookId" value={bookId} />
                <button className="text-zinc-500 underline hover:text-zinc-900 dark:hover:text-zinc-100">Remove</button>
              </form>
            </div>
          </div>
          {book && <p className="font-semibold">{formatPrice(priceCentsFor(book.id, book.pages))}</p>}
        </li>
      ))}
    </ul>
  );
}
