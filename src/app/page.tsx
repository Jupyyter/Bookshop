import Image from "next/image";
import Link from "next/link";
import { coverUrl, getBooksBySubject } from "@/lib/openlibrary";

export default async function Home() {
  const books = await getBooksBySubject("fantasy");

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-12 font-sans">
      <header className="mb-10">
                <h1 className="text-4xl font-bold tracking-tight">Fantasy books</h1>
        <p className="mt-2 text-zinc-500">Loaded live from Open Library.</p>
      </header>

      {books.length === 0 ? (
        <p className="text-zinc-500">Could not load books right now. Try again in a minute.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4">
          {books.map((book) => (
            <li key={book.id}>
              <Link href={`/books/${book.id}`} className="group flex flex-col gap-3">
                <div className="relative aspect-[2/3] overflow-hidden rounded-lg bg-zinc-200 dark:bg-zinc-800">
                  {book.coverId && (
                    <Image
                      src={coverUrl(book.coverId)}
                      alt={`Cover of ${book.title}`}
                      fill
                      sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
                      className="object-cover transition group-hover:scale-105"
                    />
                  )}
                </div>
                <div>
                  <h2 className="font-semibold leading-snug group-hover:underline">{book.title}</h2>
                  <p className="text-sm text-zinc-500">
                    {book.authors.join(", ") || "Unknown author"}
                    {book.firstPublishYear && ` · ${book.firstPublishYear}`}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}