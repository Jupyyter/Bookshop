import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { progressFor } from "@/lib/courier";
import { formatDateTime } from "@/lib/dates";
import { findGuestCartId } from "@/lib/guest-cart";
import { listOrdersForCart, listOrdersForUser } from "@/lib/orders";
import { formatPrice } from "@/lib/pricing";
import { getCurrentUser } from "@/lib/session";

export const metadata: Metadata = { title: "Your orders" };

export default function OrdersPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-12 font-sans">
      <h1 className="text-3xl font-bold tracking-tight">Your orders</h1>
      <Suspense fallback={<p className="mt-8 text-zinc-500">Loading your orders…</p>}>
        <OrderList />
      </Suspense>
    </main>
  );
}

async function OrderList() {
  await connection();

  // Signed in: every order of the account, from any device. Signed out: the orders placed from
  // this browser, plus a nudge to sign in.
  const user = await getCurrentUser();
  const guestCartId = user ? null : await findGuestCartId();
  const orders = user ? await listOrdersForUser(user) : guestCartId ? await listOrdersForCart(guestCartId) : [];

  return (
    <>
      {!user && (
        <p className="mt-4 rounded-lg bg-zinc-100 px-4 py-3 text-sm dark:bg-zinc-900">
          <Link href="/sign-in?next=/orders" className="font-medium underline">
            Sign in
          </Link>{" "}
          to see all your orders on any device. Orders you placed as a guest show up too, once you sign in with the same email.
        </p>
      )}

      {orders.length === 0 ? (
        <div className="mt-8">
          <p className="text-zinc-500">
            {user ? "You haven't placed any orders yet." : "You haven't placed any orders from this browser yet."}
          </p>
          <Link href="/" className="mt-4 inline-block underline">
            Browse books
          </Link>
        </div>
      ) : (
        <ul className="mt-8 divide-y divide-zinc-200 dark:divide-zinc-800">
          {orders.map((order) => (
            <li key={order.id}>
              <Link href={`/orders/${order.id}`} className="flex items-center justify-between gap-4 py-4 hover:opacity-80">
                <div>
                  <p className="font-medium">
                    Order <span className="font-mono">{order.id.slice(0, 8).toUpperCase()}</span>
                  </p>
                  <p className="text-sm text-zinc-500">
                    {order.paidAt && <>{formatDateTime(order.paidAt)} · </>}
                    {order.itemCount} {order.itemCount === 1 ? "book" : "books"}
                    {order.totalCents !== null && <> · {formatPrice(order.totalCents)}</>}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-zinc-100 px-3 py-1 text-sm dark:bg-zinc-800">
                  {progressFor(order.latestEvent).label}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
