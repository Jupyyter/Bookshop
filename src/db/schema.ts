import { sql } from "drizzle-orm";
import { check, integer, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";

// One row per shopping cart. The visitor's cookie holds only this random ID.
export const carts = pgTable("carts", {
  id: uuid("id").primaryKey().defaultRandom(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(), // for cleaning up old carts later
});

// One row per book in a cart.
export const cartItems = pgTable(
  "cart_items",
  {
    cartId: uuid("cart_id")
      .notNull()
      .references(() => carts.id, { onDelete: "cascade" }), // deleting a cart deletes its items
    bookId: text("book_id").notNull(),
    quantity: integer("quantity").notNull(),
    addedAt: timestamp("added_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // The same book can appear only once per cart; adding it again raises the quantity.
    primaryKey({ columns: [table.cartId, table.bookId] }),
    // The database itself refuses bad data, even if a bug in our code tries to write it.
    check("cart_items_quantity_range", sql`${table.quantity} BETWEEN 1 AND 10`),
    check("cart_items_book_id_format", sql`${table.bookId} ~ '^OL[0-9]+W$'`),
  ],
);