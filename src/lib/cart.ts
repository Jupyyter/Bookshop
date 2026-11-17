import { and, count, eq, sql } from "drizzle-orm";
import { connection } from "next/server";
import { db } from "@/db";
import { cartItems, carts, MAX_CART_QUANTITY } from "@/db/schema";
import { findGuestCartId, setCartCookie } from "@/lib/guest-cart";
import { getCurrentUser } from "@/lib/session";

// The cart lives in the database. Signed in, it belongs to the account (and follows it to every device);
// signed out, it belongs to this browser, which keeps only the cart's random ID in a cookie.
export type CartItem = { bookId: string; quantity: number };

export const MAX_QUANTITY = MAX_CART_QUANTITY;
export const MAX_ITEMS = 50;

// The cart of whoever is looking right now, or null if they don't have one yet.
export async function getCurrentCartId(): Promise<string | null> {
  const user = await getCurrentUser();
  if (!user) return findGuestCartId();

  const [cart] = await db.select({ id: carts.id }).from(carts).where(eq(carts.userId, user.id));
  return cart?.id ?? null;
}

export async function readCart(): Promise<CartItem[]> {
  // Read the cart only while answering a real request, never while Next.js pre-renders pages.
  await connection();

  const cartId = await getCurrentCartId();
  if (!cartId) return [];

  return db
    .select({ bookId: cartItems.bookId, quantity: cartItems.quantity })
    .from(cartItems)
    .where(eq(cartItems.cartId, cartId))
    .orderBy(cartItems.addedAt);
}

// Cookies can only be set from Server Actions, so only actions may call this.
async function getOrCreateCartId(): Promise<string> {
  const existing = await getCurrentCartId();
  if (existing) return existing;

  const user = await getCurrentUser();
  if (user) {
    // "On conflict" covers two first clicks at the same moment: both get the same single cart.
    const [cart] = await db
      .insert(carts)
      .values({ userId: user.id })
      .onConflictDoUpdate({ target: carts.userId, set: { updatedAt: new Date() } })
      .returning({ id: carts.id });
    return cart.id;
  }

  const [created] = await db.insert(carts).values({}).returning({ id: carts.id });
  await setCartCookie(created.id);
  return created.id;
}

export async function addItem(bookId: string): Promise<"added" | "max-quantity" | "cart-full"> {
  const cartId = await getOrCreateCartId();
  const inThisCart = and(eq(cartItems.cartId, cartId), eq(cartItems.bookId, bookId));

  const [{ itemCount }] = await db
    .select({ itemCount: count() })
    .from(cartItems)
    .where(eq(cartItems.cartId, cartId));
  if (itemCount >= MAX_ITEMS) {
    const [alreadyInCart] = await db.select().from(cartItems).where(inThisCart);
    if (!alreadyInCart) return "cart-full";
  }

  // One atomic statement: insert the book, or add 1 if it's already there (unless it's at the maximum).
  // Two quick clicks in two tabs can't overwrite each other, because Postgres does the "+ 1" itself.
  const [row] = await db
    .insert(cartItems)
    .values({ cartId, bookId, quantity: 1 })
    .onConflictDoUpdate({
      target: [cartItems.cartId, cartItems.bookId],
      set: { quantity: sql`${cartItems.quantity} + 1` },
      setWhere: sql`${cartItems.quantity} < ${MAX_QUANTITY}`,
    })
    .returning({ quantity: cartItems.quantity });
  if (!row) return "max-quantity"; // the condition blocked the update: already at the maximum

  await touchCart(cartId);
  return "added";
}

export async function setItemQuantity(bookId: string, quantity: number) {
  const cartId = await getCurrentCartId();
  if (!cartId) return;

  const inThisCart = and(eq(cartItems.cartId, cartId), eq(cartItems.bookId, bookId));
  if (quantity <= 0) {
    await db.delete(cartItems).where(inThisCart);
  } else {
    await db.update(cartItems).set({ quantity: Math.min(quantity, MAX_QUANTITY) }).where(inThisCart);
  }
  await touchCart(cartId);
}

// Remember when the cart was last used, so abandoned carts can be deleted later.
async function touchCart(cartId: string) {
  await db.update(carts).set({ updatedAt: new Date() }).where(eq(carts.id, cartId));
}
