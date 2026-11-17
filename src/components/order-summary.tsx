import Link from "next/link";
import { formatPrice } from "@/lib/pricing";

type Props = {
  order: {
    items: { bookId: string; title: string; quantity: number; unitPriceCents: number }[];
    subtotalCents: number;
    shippingCents: number | null;
    totalCents: number | null;
  };
};

// The list of books and the totals. Used on the confirmation page and on the order page.
export function OrderSummary({ order }: Props) {
  return (
    <>
      <ul className="mt-4 divide-y divide-zinc-200 dark:divide-zinc-800">
        {order.items.map((item) => (
          <li key={item.bookId} className="flex justify-between gap-4 py-3">
            <span>
              <Link href={`/books/${item.bookId}`} className="hover:underline">
                {item.title}
              </Link>{" "}
              <span className="text-zinc-500">× {item.quantity}</span>
            </span>
            <span>{formatPrice(item.unitPriceCents * item.quantity)}</span>
          </li>
        ))}
      </ul>

      <dl className="mt-4 space-y-1 border-t border-zinc-200 pt-4 dark:border-zinc-800">
        <div className="flex justify-between text-zinc-500">
          <dt>Subtotal</dt>
          <dd>{formatPrice(order.subtotalCents)}</dd>
        </div>
        <div className="flex justify-between text-zinc-500">
          <dt>Shipping</dt>
          <dd>{order.shippingCents !== null ? formatPrice(order.shippingCents) : "—"}</dd>
        </div>
        <div className="flex justify-between text-lg font-semibold">
          <dt>Total paid</dt>
          <dd>{order.totalCents !== null ? formatPrice(order.totalCents) : "—"}</dd>
        </div>
      </dl>
    </>
  );
}
