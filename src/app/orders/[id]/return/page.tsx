import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ReturnForm } from "@/components/return-form";
import { formatDate } from "@/lib/dates";
import { getOrderDetails } from "@/lib/orders";
import { ownsOrder, returnableLines, returnWindow } from "@/lib/returns";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Return books" };

type Params = PageProps<"/orders/[id]/return">["params"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function ReturnPage({ params }: PageProps<"/orders/[id]/return">) {
  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-12 font-sans">
      <Suspense fallback={<p className="text-zinc-500">Loading your order…</p>}>
        <ReturnContent params={params} />
      </Suspense>
    </main>
  );
}

async function ReturnContent({ params }: { params: Params }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const user = await requireUser(`/orders/${id}/return`); // returns are started from an account

  const order = await getOrderDetails(id);
  // Someone else's order looks exactly like one that doesn't exist.
  if (!order || order.status !== "paid" || !ownsOrder(user, order)) notFound();

  const orderNumber = order.id.slice(0, 8).toUpperCase();
  const timing = returnWindow(order);
  const lines = (await returnableLines(order.id)).filter((line) => line.left > 0);

  let blocked: string | null = null;
  if (!timing.ok) {
    blocked =
      timing.why === "too-late"
        ? `The return window for this order closed on ${formatDate(timing.deadline!)}.`
        : "You can return books once they've been delivered.";
  } else if (lines.length === 0) {
    blocked = "Every book in this order is already being returned.";
  }

  return (
    <>
      <Link href={`/orders/${order.id}`} className="text-sm text-zinc-500 hover:underline">
        ← Order {orderNumber}
      </Link>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">Return books</h1>
      {blocked ? (
        <p className="mt-6 text-zinc-600 dark:text-zinc-400">{blocked}</p>
      ) : (
        <>
          <p className="mt-2 text-zinc-500">
            Free returns until {timing.ok && formatDate(timing.deadline)}. Choose what you&apos;re sending back.
          </p>
          <ReturnForm orderId={order.id} lines={lines} shippingCents={order.shippingCents ?? 0} />
        </>
      )}
    </>
  );
}
