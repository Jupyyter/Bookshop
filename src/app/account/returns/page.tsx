import type { Metadata } from "next";
import Link from "next/link";
import { after } from "next/server";
import { Suspense } from "react";
import { formatDate } from "@/lib/dates";
import { formatPrice } from "@/lib/pricing";
import { listReturnsForUser, processDueRefunds, returnProgress } from "@/lib/returns";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Your returns" };

export default function ReturnsPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-12 font-sans">
      <Link href="/account" className="text-sm text-zinc-500 hover:underline">
        ← Your account
      </Link>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">Your returns</h1>
      <Suspense fallback={<p className="mt-8 text-zinc-500">Loading your returns…</p>}>
        <ReturnList />
      </Suspense>
    </main>
  );
}

async function ReturnList() {
  const user = await requireUser("/account/returns");
  after(processDueRefunds); // once this page is sent: refund any returns whose books have arrived
  const list = await listReturnsForUser(user.id);

  if (list.length === 0) {
    return (
      <p className="mt-8 text-zinc-500">
        No returns. To send books back, open a delivered order from{" "}
        <Link href="/orders" className="underline">
          your orders
        </Link>{" "}
        and press &quot;Return books&quot;.
      </p>
    );
  }

  return (
    <ul className="mt-8 divide-y divide-zinc-200 dark:divide-zinc-800">
      {list.map((ret) => (
        <li key={ret.id}>
          <Link href={`/account/returns/${ret.id}`} className="flex items-center justify-between gap-4 py-4 hover:opacity-80">
            <span>
              <span className="block font-medium">
                Return <span className="font-mono">{ret.returnCode}</span>
              </span>
              <span className="text-sm text-zinc-500">
                {formatDate(ret.createdAt)} · order <span className="font-mono">{ret.orderId.slice(0, 8).toUpperCase()}</span> ·{" "}
                {formatPrice(ret.refundCents)}
              </span>
            </span>
            <span className="shrink-0 rounded-full bg-zinc-100 px-3 py-1 text-sm dark:bg-zinc-800">{returnProgress(ret).label}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
