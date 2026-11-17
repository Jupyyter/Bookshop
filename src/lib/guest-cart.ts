import { and, eq, isNull, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { db } from "@/db";
import { carts, MAX_CART_QUANTITY } from "@/db/schema";

// The cart of someone who isn't signed in. Their browser keeps only the cart's random ID, in a cookie.

const COOKIE_NAME = "cart_id";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getCartIdFromCookie(): Promise<string | null> {
  const value = (await cookies()).get(COOKIE_NAME)?.value;
  // The cookie can be edited. Anything that isn't a UUID would make Postgres throw an error.
  return value && UUID_PATTERN.test(value) ? value : null;
}

// Cookies can only be set from Server Actions and Route Handlers.
export async function setCartCookie(cartId: string): Promise<void> {
  (await cookies()).set(COOKIE_NAME, cartId, {
    httpOnly: true, // JavaScript running in the page can't read or change it
    sameSite: "lax", // not sent along with form posts started by other websites
    secure: process.env.NODE_ENV === "production", // HTTPS only once the site is deployed
    maxAge: 60 * 60 * 24 * 30, // keep the cart for 30 days
    path: "/",
  });
}

// The guest cart this browser points to, if it exists and doesn't belong to an account.
// (After someone signs out, their cookie may still point at their account's cart. That cart is
// only reachable while signed in to that account, so whoever uses the browser next starts empty.)
export async function findGuestCartId(): Promise<string | null> {
  const fromCookie = await getCartIdFromCookie();
  if (!fromCookie) return null;
  const [cart] = await db
    .select({ id: carts.id })
    .from(carts)
    .where(and(eq(carts.id, fromCookie), isNull(carts.userId)));
  return cart?.id ?? null;
}

// Runs right after someone signs in (see the session hook in auth.ts). Books they added while
// signed out move into their account's cart, so nothing gets lost, and from then on the cart
// follows the account to every device.
export async function moveGuestCartToAccount(userId: string): Promise<void> {
  const guestCartId = await findGuestCartId();
  if (!guestCartId) return;

  await db.transaction(async (tx) => {
    // Lock the guest cart, so two sign-ins at the same moment can't both move it (and double the books).
    const [guest] = await tx
      .select({ id: carts.id })
      .from(carts)
      .where(and(eq(carts.id, guestCartId), isNull(carts.userId)))
      .for("update");
    if (!guest) return; // another request already moved it

    const [accountCart] = await tx.select({ id: carts.id }).from(carts).where(eq(carts.userId, userId));
    if (!accountCart) {
      // The account has no cart yet: the guest cart simply becomes the account's cart.
      await tx.update(carts).set({ userId, updatedAt: new Date() }).where(eq(carts.id, guest.id));
      return;
    }

    // Both exist: copy the guest's books into the account cart, adding up copies of the same book
    // (never past the maximum), then delete the guest cart.
    await tx.execute(sql`
      insert into cart_items (cart_id, book_id, quantity, added_at)
      select ${accountCart.id}, book_id, quantity, added_at from cart_items where cart_id = ${guest.id}
      on conflict (cart_id, book_id)
      do update set quantity = least(cart_items.quantity + excluded.quantity, ${MAX_CART_QUANTITY})
    `);
    await tx.update(carts).set({ updatedAt: new Date() }).where(eq(carts.id, accountCart.id));
    await tx.delete(carts).where(eq(carts.id, guest.id));
  });
}
