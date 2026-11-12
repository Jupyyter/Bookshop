import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { Suspense } from "react";
import { AddToCartButton } from "@/components/add-to-cart-button";
import { coverUrl, getBookDetails, isBookId } from "@/lib/openlibrary";
import { formatPrice, priceCentsFor } from "@/lib/pricing";

type Params = PageProps<"/books/[id]">["params"];

// Build one book ahead of time. Every other book is built on its first visit, then reused.
export async function generateStaticParams() {
  return [{ id: "OL27448W" }]; // The Lord of the Rings
}

// The browser tab title. Calling getBookDetails twice is free: the second call hits the cache.
export async function generateMetadata({ params }: PageProps<"/books/[id]">): Promise<Metadata> {
  const { id } = await params;
  if (!isBookId(id)) return {};

  const result = await getBookDetails(id);
  if (result.status !== "found") return {};
  return {
    title: result.book.title,
    description: result.book.description?.slice(0, 160),
  };
}

// Not async: this part never waits for the URL, so it is shown instantly on every navigation.
export default function BookPage({ params }: PageProps<"/books/[id]">) {
  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-12 font-sans">
      <Link href="/" className="text-sm text-zinc-500 hover:underline">
        ← All books
      </Link>

      {/* Everything that depends on which book is in the URL waits inside this boundary. */}
      <Suspense fallback={<BookSkeleton />}>
        <BookDetailsView params={params} />
      </Suspense>
    </main>
  );
}

async function BookDetailsView({ params }: { params: Params }) {
  const { id } = await params;
  if (!isBookId(id)) notFound();

  const result = await getBookDetails(id);
  if (result.status === "not-found") notFound();
  if (result.status === "moved") permanentRedirect(`/books/${result.id}`);
  if (result.status === "error") {
    return (
      <p className="mt-12 text-center text-zinc-500">
        Could not load this book right now. Try again in a minute.
      </p>
    );
  }

  const { book } = result; // TypeScript knows status is "found" here
  const price = priceCentsFor(book.id, book.pages);

  return (
    <div className="mt-6 grid gap-10 md:grid-cols-[280px_1fr]">
      <div className="relative aspect-[2/3] overflow-hidden rounded-lg bg-zinc-200 dark:bg-zinc-800">
        {book.coverId && (
          <Image
            src={coverUrl(book.coverId, "L")}
            alt={`Cover of ${book.title}`}
            fill
            sizes="(min-width: 768px) 280px, 100vw"
            className="object-cover"
            preload
          />
        )}
      </div>

      <div>
        <h1 className="text-3xl font-bold tracking-tight">{book.title}</h1>
        <p className="mt-1 text-lg text-zinc-500">{book.authors.join(", ") || "Unknown author"}</p>

        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-sm text-zinc-500">
          {book.firstPublished && <span>First published {book.firstPublished}</span>}
          {book.pages !== null && <span>{book.pages} pages</span>}
          {book.rating && (
            <span>
              ★ {book.rating.average.toFixed(1)} ({book.rating.count} ratings)
            </span>
          )}
        </div>

        <p className="mt-6 text-3xl font-semibold">{formatPrice(price)}</p>
        <AddToCartButton bookId={book.id} />

        {book.description && (
          <p className="mt-6 whitespace-pre-line leading-relaxed">{book.description}</p>
        )}

        {book.subjects.length > 0 && (
          <ul className="mt-6 flex flex-wrap gap-2">
            {book.subjects.map((subject) => (
              <li key={subject} className="rounded-full bg-zinc-100 px-3 py-1 text-xs dark:bg-zinc-800">
                {subject}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// Gray placeholder blocks shaped like the real page, so nothing jumps around when the book loads.
function BookSkeleton() {
  return (
    <div className="mt-6 grid animate-pulse gap-10 md:grid-cols-[280px_1fr]" aria-hidden="true">
      <div className="aspect-[2/3] rounded-lg bg-zinc-200 dark:bg-zinc-800" />
      <div>
        <div className="h-9 w-2/3 rounded bg-zinc-200 dark:bg-zinc-800" />
        <div className="mt-3 h-6 w-1/3 rounded bg-zinc-200 dark:bg-zinc-800" />
        <div className="mt-5 h-4 w-1/2 rounded bg-zinc-200 dark:bg-zinc-800" />
        <div className="mt-8 h-9 w-28 rounded bg-zinc-200 dark:bg-zinc-800" />
        <div className="mt-4 h-12 w-36 rounded-lg bg-zinc-200 dark:bg-zinc-800" />
      </div>
    </div>
  );
}