import { and, count, eq, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { db } from "@/db";
import { cartItems, carts } from "@/db/schema";

// The cart lives in the database. The visitor's cookie holds only the cart's random ID.
export type CartItem = { bookId: string; quantity: number };

const COOKIE_NAME = "cart_id";
export const MAX_QUANTITY = 10;
export const MAX_ITEMS = 50;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function getCartIdFromCookie(): Promise<string | null> {
  const value = (await cookies()).get(COOKIE_NAME)?.value;
  // The cookie can be edited. Anything that isn't a UUID would make Postgres throw an error.
  return value && UUID_PATTERN.test(value) ? value : null;
}

export async function readCart(): Promise<CartItem[]> {
  // Read the cart only while answering a real request, never while Next.js pre-renders pages.
  await connection();

  const cartId = await getCartIdFromCookie();
  if (!cartId) return [];

  return db
    .select({ bookId: cartItems.bookId, quantity: cartItems.quantity })
    .from(cartItems)
    .where(eq(cartItems.cartId, cartId))
    .orderBy(cartItems.addedAt);
}

// Cookies can only be set from Server Actions, so only actions may call this.
async function getOrCreateCartId(): Promise<string> {
  const fromCookie = await getCartIdFromCookie();
  if (fromCookie) {
    const [existing] = await db.select({ id: carts.id }).from(carts).where(eq(carts.id, fromCookie));
    if (existing) return existing.id;
  }

  const [created] = await db.insert(carts).values({}).returning({ id: carts.id });
  (await cookies()).set(COOKIE_NAME, created.id, {
    httpOnly: true, // JavaScript running in the page can't read or change it
    sameSite: "lax", // not sent along with form posts started by other websites
    secure: process.env.NODE_ENV === "production", // HTTPS only once the site is deployed
    maxAge: 60 * 60 * 24 * 30, // keep the cart for 30 days
    path: "/",
  });
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
  const cartId = await getCartIdFromCookie();
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