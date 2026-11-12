"use server";

import { refresh } from "next/cache";
import { addItem, MAX_QUANTITY, setItemQuantity } from "@/lib/cart";
import { getBookDetails, isBookId } from "@/lib/openlibrary";

// Server Actions are public endpoints: anyone can call them with any input, so check everything.

export async function addToCart(bookId: string): Promise<{ ok: boolean; message: string }> {
  if (!isBookId(bookId)) return { ok: false, message: "That is not a valid book." };

  const result = await getBookDetails(bookId); // cached, so this is cheap
  if (result.status !== "found") return { ok: false, message: "This book is not available." };

  const outcome = await addItem(bookId);
  refresh(); // re-render the page so the header count and cart show the new data

  if (outcome === "max-quantity") {
    return { ok: false, message: `You can buy at most ${MAX_QUANTITY} copies.` };
  }
  if (outcome === "cart-full") return { ok: false, message: "Your cart is full." };
  return { ok: true, message: "Added to your cart." };
}

// Used by the cart page's forms. The clicked button sends its own name and value,
// so "−", "+" and "Remove" all share this one action.
export async function updateQuantity(formData: FormData) {
  const bookId = formData.get("bookId");
  const quantity = Number(formData.get("quantity"));
  if (typeof bookId !== "string" || !isBookId(bookId) || !Number.isInteger(quantity)) return;

  await setItemQuantity(bookId, quantity);
  refresh();
}