import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { after, connection } from "next/server";
import { Suspense } from "react";
import { AutoRefresh } from "@/components/auto-refresh";
import { OrderSummary } from "@/components/order-summary";
import { type MapStop, TrackingMap } from "@/components/tracking-map";
import { PROGRESS_STEPS, progressFor } from "@/lib/courier";
import { formatDate, formatDateTime } from "@/lib/dates";
import { getOrderDetails } from "@/lib/orders";
import { formatPrice } from "@/lib/pricing";
import { listReturnsForOrder, ownsOrder, processDueRefunds, returnableLines, returnProgress, returnWindow } from "@/lib/returns";
import { getCurrentUser } from "@/lib/session";

export const metadata: Metadata = { title: "Your order" };

type Params = PageProps<"/orders/[id]">["params"];
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function OrderPage({ params }: PageProps<"/orders/[id]">) {
  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-12 font-sans">
      <Link href="/orders" className="text-sm text-zinc-500 hover:underline">
        ← Your orders
      </Link>
      <Suspense fallback={<p className="mt-8 text-zinc-500">Loading your order…</p>}>
        <OrderDetails params={params} />
      </Suspense>
    </main>
  );
}

async function OrderDetails({ params }: { params: Params }) {
  // What this page shows depends on the current time, so it is built fresh for every visit.
  await connection();

  const { id } = await params;
  if (!UUID_PATTERN.test(id)) notFound();
  const order = await getOrderDetails(id);
  // An unpaid checkout isn't an order yet, so its page doesn't exist for the buyer.
  if (!order || order.status !== "paid") notFound();

  const orderNumber = order.id.slice(0, 8).toUpperCase();

  // The whole trip is stored in advance; a step counts once its time has passed.
  const now = new Date();
  const happened = order.events.filter((event) => event.happensAt <= now);
  const latest = happened.at(-1) ?? null;
  const progress = progressFor(latest?.type ?? null);
  const delivery = order.events.find((event) => event.type === "delivered");
  const isDelivered = latest?.type === "delivered";

  // The route on the map: each place the parcel passes through, in order.
  const stops: MapStop[] = [];
  for (const event of order.events) {
    const reached = event.happensAt <= now;
    const previous = stops.at(-1);
    if (previous && previous.lat === event.lat && previous.lng === event.lng) {
      previous.reached ||= reached; // same place, later step (e.g. packed, then picked up)
    } else {
      stops.push({ name: event.locationName, lat: event.lat, lng: event.lng, reached });
    }
  }
  const currentIndex = Math.max(0, stops.findLastIndex((stop) => stop.reached));

  return (
    <div className="mt-6">
      {/* Keep the page up to date until the parcel arrives. */}
      {order.shipment && !isDelivered && <AutoRefresh seconds={15} />}

      <p className="text-sm text-zinc-500">
        Order <span className="font-mono">{orderNumber}</span>
        {order.paidAt && <> · paid {formatDateTime(order.paidAt)}</>}
      </p>
      <h1 className="mt-1 text-3xl font-bold tracking-tight">{progress.label}</h1>
      {delivery && !isDelivered && (
        <p className="mt-1 text-zinc-500">Estimated delivery: {formatDateTime(delivery.happensAt)}</p>
      )}
      {isDelivered && latest && (
        <p className="mt-1 text-zinc-500">
          Delivered {formatDateTime(latest.happensAt)}
          {order.shippingAddress?.city && <> in {order.shippingAddress.city}</>}
        </p>
      )}

      <ol className="mt-6 grid grid-cols-5 gap-2 text-xs">
        {PROGRESS_STEPS.map((label, index) => (
          <li key={label} className="flex flex-col gap-2">
            <span className={`h-1.5 rounded-full ${index <= progress.step ? "bg-green-600" : "bg-zinc-200 dark:bg-zinc-800"}`} />
            <span className={index <= progress.step ? "font-medium" : "text-zinc-500"}>{label}</span>
          </li>
        ))}
      </ol>

      {order.shipment ? (
        <>
          <TrackingMap stops={stops} currentIndex={currentIndex} />
          <p className="mt-2 text-sm text-zinc-500">
            {order.shipment.carrier} · tracking number{" "}
            <span className="font-mono">{order.shipment.trackingNumber}</span>
          </p>

          <h2 className="mt-10 text-lg font-semibold">Tracking history</h2>
          <ol className="mt-4 space-y-4 border-l-2 border-zinc-200 pl-5 dark:border-zinc-800">
            {[...happened].reverse().map((event) => (
              <li key={event.id}>
                <p className="font-medium">{event.description}</p>
                <p className="text-sm text-zinc-500">
                  {event.locationName} · {formatDateTime(event.happensAt)}
                </p>
              </li>
            ))}
            {order.paidAt && (
              <li>
                <p className="font-medium">Payment received</p>
                <p className="text-sm text-zinc-500">{formatDateTime(order.paidAt)}</p>
              </li>
            )}
          </ol>
        </>
      ) : (
        <p className="mt-6 text-zinc-500">Tracking details appear once the parcel is handed to the courier.</p>
      )}

      <h2 className="mt-10 text-lg font-semibold">Your books</h2>
      <OrderSummary order={order} />

      <ReturnsAndReceipt order={order} />
      <p className="mt-6 text-sm text-zinc-500">
        This is a demo shop paid in Stripe test mode. The courier and its journey are simulated, so no books actually ship.
      </p>
    </div>
  );
}

// Receipt link, the order's returns, and the "Return books" button when returning is possible.
async function ReturnsAndReceipt({ order }: { order: NonNullable<Awaited<ReturnType<typeof getOrderDetails>>> }) {
  after(processDueRefunds); // refunds whose books have arrived go out right after this page is sent

  const [user, orderReturns, lines] = await Promise.all([getCurrentUser(), listReturnsForOrder(order.id), returnableLines(order.id)]);
  const timing = returnWindow(order);
  const anythingLeft = lines.some((line) => line.left > 0);

  let action: React.ReactNode = null;
  if (!timing.ok && timing.why === "not-delivered") {
    action = <p className="text-sm text-zinc-500">You can return books for 30 days after they&apos;re delivered.</p>;
  } else if (!timing.ok) {
    action = <p className="text-sm text-zinc-500">The return window closed on {formatDate(timing.deadline!)}.</p>;
  } else if (anythingLeft && !user) {
    action = (
      <Link href={`/sign-in?next=${encodeURIComponent(`/orders/${order.id}/return`)}`} className="underline">
        Sign in to return books
      </Link>
    );
  } else if (anythingLeft && user && ownsOrder(user, order)) {
    action = (
      <Link
        href={`/orders/${order.id}/return`}
        className="inline-block rounded-lg border border-zinc-300 px-4 py-2 font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
      >
        Return books
      </Link>
    );
  }

  return (
    <section className="mt-10">
      <h2 className="text-lg font-semibold">Returns and receipt</h2>
      <div className="mt-3 flex flex-wrap items-center gap-6">
        <Link href={`/orders/${order.id}/receipt`} className="underline">
          View receipt
        </Link>
        {action}
      </div>
      {orderReturns.length > 0 && (
        <ul className="mt-4 divide-y divide-zinc-200 dark:divide-zinc-800">
          {orderReturns.map((ret) => (
            <li key={ret.id}>
              <Link href={`/account/returns/${ret.id}`} className="flex items-center justify-between gap-4 py-3 hover:opacity-80">
                <span>
                  Return <span className="font-mono">{ret.returnCode}</span>
                  <span className="text-sm text-zinc-500"> · {formatPrice(ret.refundCents)}</span>
                </span>
                <span className="rounded-full bg-zinc-100 px-3 py-1 text-sm dark:bg-zinc-800">{returnProgress(ret).label}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
