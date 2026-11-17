import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { AddToCartButton } from "@/components/add-to-cart-button";
import { RemoveFromCompare } from "@/components/compare";
import { MAX_COMPARE } from "@/lib/compare";
import { type BookDetails, coverUrl, getBookDetails, isBookId } from "@/lib/openlibrary";
import { formatPrice, priceCentsFor } from "@/lib/pricing";

export const metadata: Metadata = { title: "Compare books" };

type SearchParams = PageProps<"/compare">["searchParams"];

// The books to compare are in the address (/compare?ids=OL1W,OL2W), so a comparison can be
// bookmarked or sent to someone, and needs no account.
export default function ComparePage({ searchParams }: PageProps<"/compare">) {
  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-12 font-sans">
      <h1 className="text-3xl font-bold tracking-tight">Compare books</h1>
      <Suspense fallback={<p className="mt-8 text-zinc-500">Loading the comparison…</p>}>
        <Comparison searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Comparison({ searchParams }: { searchParams: SearchParams }) {
  const { ids } = await searchParams;
  // Only valid book IDs, no repeats, at most four: the address bar can contain anything.
  const wanted = [...new Set(String(ids ?? "").split(","))].filter(isBookId).slice(0, MAX_COMPARE);

  const results = await Promise.all(wanted.map((id) => getBookDetails(id))); // cached, so fast
  const books = results.flatMap((result) => (result.status === "found" ? [result.book] : []));

  if (books.length < 2) {
    return (
      <p className="mt-8 text-zinc-500">
        Tick &quot;Compare&quot; on two to four books (on their pages or in your wishlist), then press Compare in the bar at the
        bottom.{" "}
        <Link href="/" className="underline">
          Browse books
        </Link>
      </p>
    );
  }

  const price = (book: BookDetails) => priceCentsFor(book.id, book.pages);
  const cheapest = Math.min(...books.map(price));
  const ratings = books.map((book) => book.rating?.average ?? 0);
  const bestRating = Math.max(...ratings);
  const bookIds = books.map((book) => book.id);

  // One row per property; each row knows how to show its value for one book.
  const rows: { label: string; show: (book: BookDetails) => React.ReactNode }[] = [
    {
      label: "Price",
      show: (book) => (
        <span className={price(book) === cheapest ? "font-semibold text-green-700 dark:text-green-400" : "font-semibold"}>
          {formatPrice(price(book))}
          {price(book) === cheapest && <span className="block text-xs font-normal">Lowest price</span>}
        </span>
      ),
    },
    {
      label: "Rating",
      show: (book) =>
        book.rating ? (
          <span className={book.rating.average === bestRating ? "text-green-700 dark:text-green-400" : undefined}>
            ★ {book.rating.average.toFixed(1)} <span className="text-zinc-500">({book.rating.count})</span>
            {book.rating.average === bestRating && <span className="block text-xs">Best rated</span>}
          </span>
        ) : (
          <span className="text-zinc-400">No ratings</span>
        ),
    },
    { label: "Author", show: (book) => book.authors.join(", ") || "Unknown" },
    { label: "First published", show: (book) => book.firstPublished ?? "—" },
    { label: "Pages", show: (book) => book.pages ?? "—" },
    { label: "Subjects", show: (book) => book.subjects.slice(0, 4).join(", ") || "—" },
    { label: "", show: (book) => <AddToCartButton bookId={book.id} /> },
  ];

  return (
    // On a phone the table scrolls sideways instead of squeezing four books into the screen.
    <div className="mt-8 overflow-x-auto">
      <table className="w-full min-w-[640px] table-fixed border-collapse text-left text-sm">
        <thead>
          <tr>
            <th className="w-36" />
            {books.map((book) => (
              <th key={book.id} scope="col" className="px-3 pb-4 align-top font-normal">
                <Link href={`/books/${book.id}`} className="relative mb-3 block aspect-[2/3] w-28 overflow-hidden rounded bg-zinc-200 dark:bg-zinc-800">
                  {book.coverId && <Image src={coverUrl(book.coverId, "M")} alt="" fill sizes="112px" className="object-cover" />}
                </Link>
                <Link href={`/books/${book.id}`} className="block text-base font-semibold hover:underline">
                  {book.title}
                </Link>
                <RemoveFromCompare bookId={book.id} ids={bookIds} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label || "actions"} className="border-t border-zinc-200 dark:border-zinc-800">
              <th scope="row" className="py-3 pr-3 align-top font-medium text-zinc-500">
                {row.label}
              </th>
              {books.map((book) => (
                <td key={book.id} className="px-3 py-3 align-top">
                  {row.show(book)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
