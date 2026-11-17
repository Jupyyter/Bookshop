"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { MAX_WISHLIST } from "@/db/schema";
import { addItem, setItemQuantity } from "@/lib/cart";
import { getBookDetails, isBookId } from "@/lib/openlibrary";
import { getCurrentUser } from "@/lib/session";
import { addToWishlist, removeFromWishlistDb } from "@/lib/wishlist";

// Server Actions are public endpoints: anyone can call them with anything, so check everything.

// The heart button. It says what it wants ("saved" or "not saved") instead of "flip it", so two quick
// clicks, or two open tabs, can't end up in the opposite state from what the button shows.
export async function setWishlisted(
  bookId: string,
  saved: boolean,
): Promise<{ saved: boolean } | { signIn: true } | { error: string }> {
  const user = await getCurrentUser();
  if (!user) return { signIn: true };
  if (!isBookId(bookId) || typeof saved !== "boolean") return { error: "That is not a valid book." };

  if (saved) {
    const book = await getBookDetails(bookId); // cached, so cheap; keeps made-up IDs out of the list
    if (book.status !== "found") return { error: "This book is not available." };
    if ((await addToWishlist(user.id, bookId)) === "full") {
      return { error: `Your wishlist can hold ${MAX_WISHLIST} books. Remove some first.` };
    }
  } else {
    await removeFromWishlistDb(user.id, bookId);
  }
  refresh();
  return { saved };
}

// Wishlist page → "Remove".
export async function removeFromWishlist(form: FormData): Promise<void> {
  const user = await getCurrentUser();
  const bookId = String(form.get("bookId") ?? "");
  if (!user || !isBookId(bookId)) return;
  await removeFromWishlistDb(user.id, bookId);
  refresh();
}

// Wishlist page → "Move to cart": into the cart, out of the wishlist.
export async function moveToCart(form: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in?next=/wishlist");
  const bookId = String(form.get("bookId") ?? "");
  if (!isBookId(bookId)) return;

  // Leave it in the wishlist if the cart refused it (cart full), so nothing gets lost.
  const outcome = await addItem(bookId);
  if (outcome !== "cart-full") await removeFromWishlistDb(user.id, bookId);
  refresh();
}

// Cart → "Save for later": out of the cart, into the wishlist.
export async function saveForLater(form: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in?next=/cart");
  const bookId = String(form.get("bookId") ?? "");
  if (!isBookId(bookId)) return;

  if ((await addToWishlist(user.id, bookId)) === "saved") await setItemQuantity(bookId, 0);
  refresh();
}
