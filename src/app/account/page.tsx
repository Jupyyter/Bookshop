import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { ChangePasswordForm, ConnectGoogleButton, Notice, SignOutButton } from "@/components/auth-forms";
import { db } from "@/db";
import { accounts } from "@/db/schema";
import { addressLines, listAddresses } from "@/lib/addresses";
import { googleSignInEnabled } from "@/lib/auth";
import { progressFor } from "@/lib/courier";
import { formatDate, formatDateTime } from "@/lib/dates";
import { listOrdersForUser } from "@/lib/orders";
import { formatPrice } from "@/lib/pricing";
import { getCurrentUser } from "@/lib/session";

export const metadata: Metadata = { title: "Your account" };

type SearchParams = PageProps<"/account">["searchParams"];

export default function AccountPage({ searchParams }: PageProps<"/account">) {
  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-12 font-sans">
      <Suspense fallback={<p className="text-zinc-500">Loading your account…</p>}>
        <AccountContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function AccountContent({ searchParams }: { searchParams: SearchParams }) {
  await connection();

  const { error } = await searchParams;
  const user = await getCurrentUser();
  if (!user) {
    // The "confirm your email" link lands here. If its token was bad, Better Auth adds ?error=…
    redirect(error ? "/sign-in?error=invalid_link" : "/sign-in?next=/account");
  }

  const [orders, savedAddresses, signInMethods] = await Promise.all([
    listOrdersForUser(user),
    listAddresses(user.id),
    // How this account can sign in: "credential" is email + password, "google" is Google.
    db.select({ providerId: accounts.providerId }).from(accounts).where(eq(accounts.userId, user.id)),
  ]);
  const recent = orders.slice(0, 3);
  const defaultAddress = savedAddresses.find((address) => address.isDefault);
  const hasPassword = signInMethods.some((method) => method.providerId === "credential");
  const hasGoogle = signInMethods.some((method) => method.providerId === "google");

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Hello, {user.name}</h1>
          <p className="mt-1 text-zinc-500">
            {user.email} · customer since {formatDate(user.createdAt)}
          </p>
        </div>
        <SignOutButton />
      </div>

      {typeof error === "string" && (
        <div className="mt-6">
          <Notice>{linkErrorMessage(error)}</Notice>
        </div>
      )}

      <div className="mt-8 grid gap-4 sm:grid-cols-2 md:grid-cols-4">
        <Tile href="/orders" title="Your orders">
          {orders.length === 0 ? "No orders yet" : `${orders.length} ${orders.length === 1 ? "order" : "orders"}`}
        </Tile>
        <Tile href="/account/addresses" title="Addresses">
          {defaultAddress ? addressLines(defaultAddress).slice(0, 2).join(", ") : "Save where your books should go"}
        </Tile>
        <Tile href="/account/cards" title="Saved cards">
          Manage the cards you saved at checkout
        </Tile>
        <Tile href="/account/returns" title="Returns">
          Send books back and follow your refunds
        </Tile>
      </div>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">Recent orders</h2>
        {recent.length === 0 ? (
          <p className="mt-3 text-zinc-500">
            No orders yet.{" "}
            <Link href="/" className="underline">
              Browse books
            </Link>
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-zinc-200 dark:divide-zinc-800">
            {recent.map((order) => (
              <li key={order.id}>
                <Link href={`/orders/${order.id}`} className="flex items-center justify-between gap-4 py-3 hover:opacity-80">
                  <span>
                    Order <span className="font-mono">{order.id.slice(0, 8).toUpperCase()}</span>
                    <span className="text-sm text-zinc-500">
                      {order.paidAt && <> · {formatDateTime(order.paidAt)}</>}
                      {order.totalCents !== null && <> · {formatPrice(order.totalCents)}</>}
                    </span>
                  </span>
                  <span className="shrink-0 rounded-full bg-zinc-100 px-3 py-1 text-sm dark:bg-zinc-800">
                    {progressFor(order.latestEvent).label}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">Signing in</h2>
        <ul className="mt-3 space-y-2 text-sm">
          <li>Email and password: {hasPassword ? "✓ set up" : "not set up"}</li>
          <li>Google: {hasGoogle ? "✓ connected" : "not connected"}</li>
        </ul>
        {googleSignInEnabled && !hasGoogle && (
          <div className="mt-4">
            <ConnectGoogleButton />
          </div>
        )}
        {hasPassword ? (
          <>
            <h3 className="mt-8 font-semibold">Change password</h3>
            <ChangePasswordForm />
          </>
        ) : (
          <p className="mt-4 text-sm text-zinc-500">You sign in with Google, so there&apos;s no password to manage here.</p>
        )}
      </section>
    </>
  );
}

function Tile({ href, title, children }: { href: string; title: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="rounded-xl border border-zinc-200 p-5 transition hover:border-zinc-400 dark:border-zinc-800 dark:hover:border-zinc-600">
      <p className="font-semibold">{title}</p>
      <p className="mt-1 text-sm text-zinc-500">{children}</p>
    </Link>
  );
}

// "Connect Google" comes back here with ?error=… when it didn't work.
function linkErrorMessage(code: string): string {
  switch (code) {
    case "email_doesn't_match":
      return "That Google account uses a different email than this account, so it wasn't connected.";
    case "account_already_linked_to_different_user":
      return "That Google account is already connected to a different Bookshop account.";
    case "access_denied":
      return "Connecting Google was cancelled.";
    default:
      return "Connecting Google didn't work. Try again in a minute.";
  }
}
