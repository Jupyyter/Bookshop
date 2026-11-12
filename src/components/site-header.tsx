import Link from "next/link";
import { Suspense } from "react";
import { readCart } from "@/lib/cart";

export function SiteHeader() {
  return (
    <header className="border-b border-zinc-200 dark:border-zinc-800">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4 font-sans">
        <Link href="/" className="text-lg font-bold tracking-tight">
          📚 Bookshop
        </Link>
        <Link href="/cart" className="flex items-center gap-2 font-medium hover:underline">
          Cart
          {/* The count depends on this visitor's cookie, so it can't be built ahead of time.
              Suspense lets the rest of the header be pre-built and streams the count in. */}
          <Suspense fallback={null}>
            <CartCount />
          </Suspense>
        </Link>
      </div>
    </header>
  );
}

async function CartCount() {
  const cart = await readCart();
  const count = cart.reduce((sum, item) => sum + item.quantity, 0);
  if (count === 0) return null;

  return (
    <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-xs text-white dark:bg-white dark:text-zinc-900">
      {count}
    </span>
  );
}