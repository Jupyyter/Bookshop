import Link from "next/link";
import { Suspense } from "react";
import { readCart } from "@/lib/cart";
import { getCurrentUser } from "@/lib/session";

export function SiteHeader() {
  return (
    <header className="border-b border-zinc-200 print:hidden dark:border-zinc-800">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4 font-sans">
        <Link href="/" className="text-lg font-bold tracking-tight">
          📚 Bookshop
        </Link>
        <nav className="flex items-center gap-6 font-medium">
          {/* Who is signed in depends on this visitor's cookies, so it can't be built ahead of time.
              Suspense lets the rest of the header be pre-built and streams these parts in. */}
          <Suspense fallback={<span className="w-14" />}>
            <AccountLink />
          </Suspense>
          <Link href="/wishlist" className="hover:underline">
            Wishlist
          </Link>
          <Link href="/orders" className="hover:underline">
            Orders
          </Link>
          <Link href="/cart" className="flex items-center gap-2 hover:underline">
            Cart
            <Suspense fallback={null}>
              <CartCount />
            </Suspense>
          </Link>
        </nav>
      </div>
    </header>
  );
}

async function AccountLink() {
  const user = await getCurrentUser();
  if (!user) {
    return (
      <Link href="/sign-in" className="hover:underline">
        Sign in
      </Link>
    );
  }
  const firstName = user.name.trim().split(/\s+/)[0];
  return (
    <Link href="/account" className="hover:underline" title={`Signed in as ${user.email}`}>
      {firstName ? `Hi, ${firstName}` : "Account"}
    </Link>
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
