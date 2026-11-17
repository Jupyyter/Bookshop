import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { OrderSummary } from "@/components/order-summary";
import { fulfillCheckout, getOrderBySessionId } from "@/lib/orders";

export const metadata: Metadata = { title: "Order confirmation" };

type SearchParams = PageProps<"/checkout/success">["searchParams"];

export default function CheckoutSuccessPage({ searchParams }: PageProps<"/checkout/success">) {
  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-12 font-sans">
      <Suspense fallback={<p className="text-zinc-500">Confirming your payment…</p>}>
        <OrderConfirmation searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function OrderConfirmation({ searchParams }: { searchParams: SearchParams }) {
  // This page talks to Stripe and updates the database, so it must only run for a real visitor,
  // never while Next.js pre-renders pages in the background.
  await connection();

  const { session_id: sessionId } = await searchParams;
  if (typeof sessionId !== "string" || !/^cs_(test|live)_[A-Za-z0-9]+$/.test(sessionId)) notFound();

  // The webhook normally marks the order paid first. Checking here too means this page is right
  // even when the webhook is a few seconds late. Running it twice is harmless.
  try {
    await fulfillCheckout(sessionId);
  } catch (error) {
    console.error("Could not check the payment with Stripe:", error);
  }

  const order = await getOrderBySessionId(sessionId);
  if (!order) notFound();

  const orderNumber = order.id.slice(0, 8).toUpperCase();

  if (order.status === "expired") {
    return (
      <div>
        <h1 className="text-3xl font-bold tracking-tight">This checkout expired</h1>
        <p className="mt-3 text-zinc-500">No payment was taken. Your cart is still saved.</p>
        <Link href="/cart" className="mt-6 inline-block underline">
          Back to your cart
        </Link>
      </div>
    );
  }

  if (order.status !== "paid") {
    return (
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Confirming your payment…</h1>
        <p className="mt-3 text-zinc-500">
          Stripe hasn&apos;t confirmed order {orderNumber} yet. Refresh this page in a few seconds.
        </p>
      </div>
    );
  }

  return (
    <div>
      <p className="text-sm font-medium text-green-700 dark:text-green-400">Payment received</p>
      <h1 className="mt-1 text-3xl font-bold tracking-tight">Thank you for your order!</h1>
      <p className="mt-2 text-zinc-500">
        Order <span className="font-mono">{orderNumber}</span>
        {order.email && <> · a confirmation email is on its way to {order.email}</>}
      </p>

      <div className="mt-8">
        <OrderSummary order={order} />
      </div>

      {order.shippingName && (
        <p className="mt-6 text-zinc-500">
          Ships to {order.shippingName}
          {order.shippingAddress?.city && `, ${order.shippingAddress.city}`}.
        </p>
      )}

      <div className="mt-8 flex flex-wrap items-center gap-6">
        <Link
          href={`/orders/${order.id}`}
          className="rounded-lg bg-zinc-900 px-6 py-3 font-medium text-white transition hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          Track your order
        </Link>
        <Link href="/" className="underline">
          Keep browsing
        </Link>
      </div>
    </div>
  );
}
