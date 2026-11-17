import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { after } from "next/server";
import { Suspense } from "react";
import { AutoRefresh } from "@/components/auto-refresh";
import { formatDateTime } from "@/lib/dates";
import { formatPrice } from "@/lib/pricing";
import { RETURN_REASON_LABELS, RETURN_STEPS } from "@/lib/return-rules";
import { getReturn, processDueRefunds, returnProgress } from "@/lib/returns";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Your return" };

type Params = PageProps<"/account/returns/[id]">["params"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function ReturnPage({ params }: PageProps<"/account/returns/[id]">) {
  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-12 font-sans">
      <Link href="/account/returns" className="text-sm text-zinc-500 hover:underline">
        ← Your returns
      </Link>
      <Suspense fallback={<p className="mt-8 text-zinc-500">Loading your return…</p>}>
        <ReturnDetails params={params} />
      </Suspense>
    </main>
  );
}

async function ReturnDetails({ params }: { params: Params }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const user = await requireUser(`/account/returns/${id}`);
  const ret = await getReturn(id);
  if (!ret || ret.userId !== user.id) notFound(); // someone else's return looks like no return at all

  after(processDueRefunds); // if the books have "arrived", the refund goes out right after this page is sent

  const now = new Date();
  const progress = returnProgress(ret, now);
  const amount = formatPrice(ret.refundCents);

  // The history so far, newest first.
  const history = [
    ret.refundedAt && { label: `${amount} refunded to your card`, at: ret.refundedAt },
    ret.receivedAt <= now && { label: "Your books arrived at our warehouse", at: ret.receivedAt },
    ret.droppedOffAt <= now && { label: "The courier collected your parcel", at: ret.droppedOffAt },
    { label: "Return started", at: ret.createdAt },
  ].filter((entry): entry is { label: string; at: Date } => Boolean(entry));

  return (
    <div className="mt-6">
      {!progress.done && <AutoRefresh seconds={10} />}
      <p className="text-sm text-zinc-500">
        Return <span className="font-mono">{ret.returnCode}</span> · order{" "}
        <Link href={`/orders/${ret.orderId}`} className="font-mono underline">
          {ret.orderId.slice(0, 8).toUpperCase()}
        </Link>
      </p>
      <h1 className="mt-1 text-3xl font-bold tracking-tight">{progress.label}</h1>

      <ol className="mt-6 grid grid-cols-4 gap-2 text-xs">
        {RETURN_STEPS.map((label, index) => (
          <li key={label} className="flex flex-col gap-2">
            <span className={`h-1.5 rounded-full ${index <= progress.step ? "bg-green-600" : "bg-zinc-200 dark:bg-zinc-800"}`} />
            <span className={index <= progress.step ? "font-medium" : "text-zinc-500"}>{label}</span>
          </li>
        ))}
      </ol>

      {ret.droppedOffAt > now && (
        <div className="mt-6 rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
          <p className="font-semibold">What to do now</p>
          <p className="mt-1 text-zinc-600 dark:text-zinc-400">
            Pack the books, write <span className="font-mono font-semibold">{ret.returnCode}</span> on the parcel and hand it to any Demo
            Courier point. (This is a demo: the courier collects it by itself in a couple of minutes.)
          </p>
        </div>
      )}

      <div className="mt-6 rounded-xl bg-zinc-100 p-5 dark:bg-zinc-900">
        <p className="text-lg">
          Refund: <strong>{amount}</strong>
          {ret.includesShipping && <span className="text-sm text-zinc-500"> (including shipping)</span>}
        </p>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{refundMessage(ret.refundStatus, ret.refundFailure)}</p>
      </div>

      <h2 className="mt-10 text-lg font-semibold">History</h2>
      <ol className="mt-4 space-y-4 border-l-2 border-zinc-200 pl-5 dark:border-zinc-800">
        {history.map((entry) => (
          <li key={entry.label}>
            <p className="font-medium">{entry.label}</p>
            <p className="text-sm text-zinc-500">{formatDateTime(entry.at)}</p>
          </li>
        ))}
      </ol>

      <h2 className="mt-10 text-lg font-semibold">Books in this return</h2>
      <ul className="mt-3 divide-y divide-zinc-200 dark:divide-zinc-800">
        {ret.items.map((item) => (
          <li key={item.bookId} className="flex justify-between gap-4 py-3">
            <span>
              {item.title} <span className="text-zinc-500">× {item.quantity}</span>
            </span>
            <span>{formatPrice(item.unitPriceCents * item.quantity)}</span>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-sm text-zinc-500">
        Reason: {RETURN_REASON_LABELS[ret.reason]}
        {ret.note && <> · &quot;{ret.note}&quot;</>}
      </p>
    </div>
  );
}

function refundMessage(status: string | null, failure: string | null): string {
  switch (status) {
    case "succeeded":
      return "Sent back to the card you paid with. Banks usually take 5 to 10 business days to show it on your statement.";
    case "pending":
    case "requires_action":
    case "processing":
      return "We've asked our payment provider to send the money back. This usually takes a few seconds.";
    case "failed":
    case "canceled":
      return `The refund couldn't be completed${failure ? ` (${failure.replaceAll("_", " ")})` : ""}. We'll get in touch to sort it out.`;
    default:
      return "We send the refund as soon as your books reach our warehouse.";
  }
}
