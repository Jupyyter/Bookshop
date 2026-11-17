import { and, count, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { MAX_WISHLIST, wishlistItems } from "@/db/schema";

// The account's wishlist: books saved for later. Only IDs are stored; titles, covers and prices
// come from the (cached) book data whenever the list is shown, so they're never out of date.

export async function listWishlist(userId: string) {
  return db
    .select({ bookId: wishlistItems.bookId, addedAt: wishlistItems.addedAt })
    .from(wishlistItems)
    .where(eq(wishlistItems.userId, userId))
    .orderBy(desc(wishlistItems.addedAt));
}

export async function isInWishlist(userId: string, bookId: string): Promise<boolean> {
  const [row] = await db
    .select({ bookId: wishlistItems.bookId })
    .from(wishlistItems)
    .where(and(eq(wishlistItems.userId, userId), eq(wishlistItems.bookId, bookId)));
  return Boolean(row);
}

export async function addToWishlist(userId: string, bookId: string): Promise<"saved" | "full"> {
  const [{ total }] = await db.select({ total: count() }).from(wishlistItems).where(eq(wishlistItems.userId, userId));
  if (total >= MAX_WISHLIST && !(await isInWishlist(userId, bookId))) return "full";
  // Saving a book that's already there does nothing (instead of failing), so double clicks are harmless.
  await db.insert(wishlistItems).values({ userId, bookId }).onConflictDoNothing();
  return "saved";
}

export async function removeFromWishlistDb(userId: string, bookId: string): Promise<void> {
  await db.delete(wishlistItems).where(and(eq(wishlistItems.userId, userId), eq(wishlistItems.bookId, bookId)));
}
