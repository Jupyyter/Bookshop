import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { updateQuantity } from "@/app/actions/cart";
import { saveForLater } from "@/app/actions/wishlist";
import { type AddressOption, CheckoutButton } from "@/components/checkout-button";
import { addressLines, listAddresses } from "@/lib/addresses";
import { MAX_QUANTITY, readCart } from "@/lib/cart";
import { coverUrl, getBookDetails } from "@/lib/openlibrary";
import { FREE_SHIPPING_FROM_CENTS, formatPrice, priceCentsFor, STANDARD_SHIPPING_CENTS } from "@/lib/pricing";
import { getCurrentUser } from "@/lib/session";

export const metadata: Metadata = { title: "Your cart" };

export default function CartPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-12 font-sans">
      <h1 className="text-3xl font-bold tracking-tight">Your cart</h1>
      <Suspense fallback={<p className="mt-8 text-zinc-500">Loading your cart…</p>}>
        <CartContents />
      </Suspense>
    </main>
  );
}

async function CartContents() {
  const cart = await readCart();
  const signedIn = Boolean(await getCurrentUser()); // "Save for later" needs an account

  if (cart.length === 0) {
    return (
      <div className="mt-8">
        <p className="text-zinc-500">Your cart is empty.</p>
        <Link href="/" className="mt-4 inline-block underline">
          Browse books
        </Link>
      </div>
    );
  }

  // Prices are worked out here, on the server, from the book data.
  // The cookie only holds IDs and quantities, so a visitor can't change what they pay.
  const lines = (
    await Promise.all(
      cart.map(async (item) => {
        const result = await getBookDetails(item.bookId);
        if (result.status !== "found") return null; // book disappeared: leave it out
        const unitPrice = priceCentsFor(result.book.id, result.book.pages);
        return { ...item, book: result.book, unitPrice, lineTotal: unitPrice * item.quantity };
      }),
    )
  ).filter((line) => line !== null);

  const subtotal = lines.reduce((sum, line) => sum + line.lineTotal, 0);

  return (
    <>
      <ul className="mt-8 divide-y divide-zinc-200 dark:divide-zinc-800">
        {lines.map((line) => (
          <li key={line.bookId} className="flex gap-4 py-4">
            <Link
              href={`/books/${line.bookId}`}
              className="relative h-24 w-16 shrink-0 overflow-hidden rounded bg-zinc-200 dark:bg-zinc-800"
            >
              {line.book.coverId && (
                <Image src={coverUrl(line.book.coverId)} alt="" fill sizes="64px" className="object-cover" />
              )}
            </Link>

            <div className="flex flex-1 flex-col justify-between gap-2">
              <div>
                <Link href={`/books/${line.bookId}`} className="font-semibold hover:underline">
                  {line.book.title}
                </Link>
                <p className="text-sm text-zinc-500">{formatPrice(line.unitPrice)} each</p>
              </div>

              {/* A plain form: works even before the page's JavaScript has loaded. */}
              <form action={updateQuantity} className="flex items-center gap-2 text-sm">
                <input type="hidden" name="bookId" value={line.bookId} />
                <button
                  name="quantity"
                  value={line.quantity - 1}
                  aria-label="One less"
                  className="h-8 w-8 rounded border border-zinc-300 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
                >
                  −
                </button>
                <span className="w-6 text-center">{line.quantity}</span>
                <button
                  name="quantity"
                  value={line.quantity + 1}
                  disabled={line.quantity >= MAX_QUANTITY}
                  aria-label="One more"
                  className="h-8 w-8 rounded border border-zinc-300 hover:bg-zinc-100 disabled:opacity-40 dark:border-zinc-700 dark:hover:bg-zinc-800"
                >
                  +
                </button>
                <button name="quantity" value={0} className="ml-4 text-zinc-500 underline hover:text-zinc-900 dark:hover:text-zinc-100">
                  Remove
                </button>
                {signedIn && (
                  // formAction sends this one button's click to a different action than the rest of the form.
                  <button formAction={saveForLater} className="text-zinc-500 underline hover:text-zinc-900 dark:hover:text-zinc-100">
                    Save for later
                  </button>
                )}
              </form>
            </div>

            <p className="font-semibold">{formatPrice(line.lineTotal)}</p>
          </li>
        ))}
      </ul>

      <div className="mt-6 flex items-center justify-between border-t border-zinc-200 pt-6 text-lg dark:border-zinc-800">
        <span>Subtotal</span>
        <span className="font-semibold">{formatPrice(subtotal)}</span>
      </div>
      <p className="mt-1 text-sm text-zinc-500">
        Standard shipping {formatPrice(STANDARD_SHIPPING_CENTS)}, free from {formatPrice(FREE_SHIPPING_FROM_CENTS)}.
        You choose the shipping method on the payment page.
      </p>

      <SignedInCheckout />
    </>
  );
}

// Guests get the plain button (they type everything on the payment page). Signed-in customers
// also choose one of their saved addresses, with the default one picked already.
async function SignedInCheckout() {
  const user = await getCurrentUser();
  if (!user) return <CheckoutButton />;

  const saved = await listAddresses(user.id);
  const options: AddressOption[] = saved.map((address) => ({
    id: address.id,
    title: address.label ? `${address.label} · ${address.fullName}` : address.fullName,
    summary: addressLines(address).join(", "),
  }));
  return <CheckoutButton addresses={options} defaultAddressId={saved.find((a) => a.isDefault)?.id} />;
}
