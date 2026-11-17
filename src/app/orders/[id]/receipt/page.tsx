import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import type Stripe from "stripe";
import { PrintButton } from "@/components/print-button";
import { formatDate, formatDateTime } from "@/lib/dates";
import { getOrderDetails } from "@/lib/orders";
import { formatPrice } from "@/lib/pricing";
import { refundsForOrders } from "@/lib/returns";
import { getStripe } from "@/lib/stripe";

export const metadata: Metadata = { title: "Receipt" };

type Params = PageProps<"/orders/[id]/receipt">["params"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const countryNames = new Intl.DisplayNames(["en"], { type: "region" });

export default function ReceiptPage({ params }: PageProps<"/orders/[id]/receipt">) {
  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-12 font-sans print:py-0">
      <Suspense fallback={<p className="text-zinc-500">Loading the receipt…</p>}>
        <Receipt params={params} />
      </Suspense>
    </main>
  );
}

// Which card paid, and Stripe's own receipt, straight from Stripe. Optional extras: if Stripe can't
// be reached, the receipt still shows everything from our own database.
async function paymentDetails(paymentIntentId: string | null) {
  if (!paymentIntentId) return null;
  try {
    const intent = await getStripe().paymentIntents.retrieve(paymentIntentId, { expand: ["latest_charge"] });
    const charge = intent.latest_charge as Stripe.Charge | null;
    const card = charge?.payment_method_details?.card;
    return { card: card ? `${card.brand} •••• ${card.last4}` : null, stripeReceipt: charge?.receipt_url ?? null };
  } catch (error) {
    console.error("Could not load the payment from Stripe:", error);
    return null;
  }
}

async function Receipt({ params }: { params: Params }) {
  await connection();
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const order = await getOrderDetails(id); // like the order page: the link itself is the key
  if (!order || order.status !== "paid") notFound();

  const [refunds, payment] = await Promise.all([refundsForOrders([order.id]), paymentDetails(order.stripePaymentIntentId)]);
  const refunded = refunds.reduce((sum, refund) => sum + refund.refundCents, 0);
  const total = order.totalCents ?? order.subtotalCents;
  const address = order.shippingAddress;

  return (
    <>
      <div className="flex items-start justify-between gap-4 print:hidden">
        <Link href={`/orders/${order.id}`} className="text-sm text-zinc-500 hover:underline">
          ← Order {order.id.slice(0, 8).toUpperCase()}
        </Link>
        <PrintButton />
      </div>

      <div className="mt-6 rounded-xl border border-zinc-200 p-8 dark:border-zinc-800 print:border-0 print:p-0">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xl font-bold">📚 Bookshop</p>
            <p className="text-sm text-zinc-500">Demo shop · Bucharest, Romania</p>
          </div>
          <div className="text-right text-sm">
            <p className="text-2xl font-bold">Receipt</p>
            <p className="font-mono">{order.id.slice(0, 8).toUpperCase()}</p>
            {order.paidAt && <p className="text-zinc-500">Paid {formatDate(order.paidAt)}</p>}
          </div>
        </div>

        <div className="mt-8 grid gap-6 text-sm sm:grid-cols-2">
          <div>
            <p className="font-semibold">Billed and shipped to</p>
            <p className="mt-1 leading-6 text-zinc-600 dark:text-zinc-400">
              {[
                order.shippingName,
                address?.line1,
                address?.line2,
                [address?.postal_code, address?.city].filter(Boolean).join(" "),
                address?.country ? countryNames.of(address.country) : null,
                order.email,
              ]
                .filter(Boolean)
                .map((line) => (
                  <span key={line} className="block">
                    {line}
                  </span>
                ))}
            </p>
          </div>
          <div>
            <p className="font-semibold">Payment</p>
            <p className="mt-1 leading-6 text-zinc-600 capitalize dark:text-zinc-400">{payment?.card ?? "Card"}</p>
            {order.paidAt && <p className="text-zinc-600 dark:text-zinc-400">{formatDateTime(order.paidAt)}</p>}
          </div>
        </div>

        <table className="mt-8 w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-left text-zinc-500 dark:border-zinc-800">
              <th className="py-2 font-medium">Book</th>
              <th className="py-2 text-right font-medium">Qty</th>
              <th className="py-2 text-right font-medium">Price</th>
              <th className="py-2 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item) => (
              <tr key={item.bookId} className="border-b border-zinc-100 dark:border-zinc-900">
                <td className="py-2">{item.title}</td>
                <td className="py-2 text-right">{item.quantity}</td>
                <td className="py-2 text-right">{formatPrice(item.unitPriceCents)}</td>
                <td className="py-2 text-right">{formatPrice(item.unitPriceCents * item.quantity)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <dl className="mt-4 ml-auto w-full max-w-xs space-y-1 text-sm">
          <Row label="Subtotal" value={formatPrice(order.subtotalCents)} />
          <Row label="Shipping" value={formatPrice(order.shippingCents ?? 0)} />
          <Row label="Total paid" value={formatPrice(total)} strong />
          {refunds.map((refund) => (
            <Row
              key={refund.returnCode}
              label={`Refund ${refund.returnCode}${refund.refundStatus === "succeeded" ? "" : " (on its way)"}`}
              value={`−${formatPrice(refund.refundCents)}`}
            />
          ))}
          {refunds.length > 0 && <Row label="Net paid" value={formatPrice(total - refunded)} strong />}
        </dl>

        <p className="mt-8 text-xs text-zinc-500">
          This is a demo shop paid in Stripe test mode. No real money was charged and this is not a tax document.
        </p>
      </div>

      {payment?.stripeReceipt && (
        <p className="mt-4 text-sm print:hidden">
          <a href={payment.stripeReceipt} className="underline" target="_blank" rel="noreferrer">
            Stripe&apos;s receipt for this payment
          </a>
        </p>
      )}
    </>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between gap-4 ${strong ? "border-t border-zinc-200 pt-1 font-semibold dark:border-zinc-800" : ""}`}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
