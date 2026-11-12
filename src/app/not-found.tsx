import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-24 text-center font-sans">
      <h1 className="text-3xl font-bold">Page not found</h1>
      <p className="mt-2 text-zinc-500">This book or page does not exist.</p>
      <Link href="/" className="mt-6 inline-block underline">
        Back to all books
      </Link>
    </main>
  );
}