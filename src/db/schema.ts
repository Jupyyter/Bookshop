import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type Stripe from "stripe";
import { RETURN_REASONS } from "../lib/return-rules"; // relative path: drizzle-kit reads this file too
import { users } from "./auth-schema";

// The account tables live in their own file; this makes them part of the same schema.
export * from "./auth-schema";

// The most copies of one book a cart can hold. The database enforces it too (see cart_items below).
export const MAX_CART_QUANTITY = 10;

// One row per shopping cart. A guest's cart is found through their cookie;
// a signed-in customer's cart is found through user_id, so it follows them to every device.
export const carts = pgTable("carts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .unique() // at most one cart per account
    .references(() => users.id, { onDelete: "cascade" }),
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
    check("cart_items_quantity_range", sql`${table.quantity} BETWEEN 1 AND ${sql.raw(String(MAX_CART_QUANTITY))}`),
    check("cart_items_book_id_format", sql`${table.bookId} ~ '^OL[0-9]+W$'`),
  ],
);

// An order can only ever be in one of these states. More come later (shipped, delivered…).
export const orderStatus = pgEnum("order_status", ["pending", "paid", "expired"]);

// One row per order. Created as "pending" when the buyer clicks Checkout,
// then marked "paid" or "expired" when Stripe tells us what happened.
export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cartId: uuid("cart_id").references(() => carts.id, { onDelete: "set null" }),
    // Set when the buyer was signed in. Guest orders stay null and are matched to an account by email.
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    status: orderStatus("status").notNull().default("pending"),
    currency: text("currency").notNull(),
    subtotalCents: integer("subtotal_cents").notNull(),
    shippingCents: integer("shipping_cents"), // known after payment: the buyer picks the shipping method on Stripe's page
    totalCents: integer("total_cents"), // the amount Stripe actually charged
    email: text("email"),
    shippingName: text("shipping_name"),
    shippingAddress: jsonb("shipping_address").$type<Stripe.Address>(),
    stripeSessionId: text("stripe_session_id").unique(),
    stripePaymentIntentId: text("stripe_payment_intent_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    paidAt: timestamp("paid_at", { withTimezone: true }),
  },
  (table) => [
    check("orders_subtotal_not_negative", sql`${table.subtotalCents} >= 0`),
    // The account's order list looks orders up by account, and by email for orders placed as a guest.
    index("orders_user_id_idx").on(table.userId),
    index("orders_email_idx").on(sql`lower(${table.email})`),
  ],
);

// One row per book in an order. Title and price are copied in at the moment of purchase,
// so the order stays correct even if the book's price or title changes later.
export const orderItems = pgTable(
  "order_items",
  {
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    bookId: text("book_id").notNull(),
    title: text("title").notNull(),
    unitPriceCents: integer("unit_price_cents").notNull(),
    quantity: integer("quantity").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.orderId, table.bookId] }),
    check("order_items_quantity_range", sql`${table.quantity} BETWEEN 1 AND 10`),
    check("order_items_price_not_negative", sql`${table.unitPriceCents} >= 0`),
  ],
);

// The steps a parcel goes through. Defined here because the database stores them as an enum.
export const SHIPMENT_EVENT_TYPES = [
  "packed",
  "picked_up",
  "arrived_at_hub",
  "departed_hub",
  "out_for_delivery",
  "delivered",
] as const;
export type ShipmentEventType = (typeof SHIPMENT_EVENT_TYPES)[number];
export const shipmentEventType = pgEnum("shipment_event_type", SHIPMENT_EVENT_TYPES);

// One parcel per paid order, with the courier's tracking number.
export const shipments = pgTable("shipments", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id")
    .notNull()
    .unique() // one shipment per order
    .references(() => orders.id, { onDelete: "cascade" }),
  carrier: text("carrier").notNull(),
  trackingNumber: text("tracking_number").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Every scan of the parcel: where it was and when. The whole trip is planned at once,
// and a step counts as "happened" once its time has passed.
export const shipmentEvents = pgTable(
  "shipment_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    shipmentId: uuid("shipment_id")
      .notNull()
      .references(() => shipments.id, { onDelete: "cascade" }),
    type: shipmentEventType("type").notNull(),
    description: text("description").notNull(),
    locationName: text("location_name").notNull(),
    lat: doublePrecision("lat").notNull(),
    lng: doublePrecision("lng").notNull(),
    happensAt: timestamp("happens_at", { withTimezone: true }).notNull(),
  },
  // Lookups are always "events of this shipment, in time order", so index exactly that.
  (table) => [index("shipment_events_shipment_time_idx").on(table.shipmentId, table.happensAt)],
);

// ---------- Account extras ----------

// Each account gets one Stripe "customer" the first time it pays or saves a card. Stripe keeps the
// saved cards on that customer; we only remember which customer belongs to which account.
export const stripeCustomers = pgTable("stripe_customers", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  stripeCustomerId: text("stripe_customer_id").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const MAX_ADDRESSES = 10;

// The account's address book. One address can be the default, which the cart picks automatically.
export const addresses = pgTable(
  "addresses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    label: text("label"), // optional: "Home", "Work"…
    fullName: text("full_name").notNull(),
    phone: text("phone"),
    line1: text("line1").notNull(),
    line2: text("line2"),
    city: text("city").notNull(),
    county: text("county").notNull(), // county code, like "CJ" or "B" for Bucharest
    postalCode: text("postal_code").notNull(),
    country: text("country").notNull().default("RO"),
    isDefault: boolean("is_default").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("addresses_user_id_idx").on(table.userId),
    // At most one default address per account. A "partial" unique index: it only covers default rows.
    uniqueIndex("addresses_one_default_per_user").on(table.userId).where(sql`${table.isDefault}`),
  ],
);

export type Address = typeof addresses.$inferSelect;

export const MAX_WISHLIST = 100;

// Books saved for later. One row per (account, book); signing in is required, so it follows you everywhere.
export const wishlistItems = pgTable(
  "wishlist_items",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    bookId: text("book_id").notNull(),
    addedAt: timestamp("added_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.bookId] }), // the same book can't be saved twice
    check("wishlist_items_book_id_format", sql`${table.bookId} ~ '^OL[0-9]+W$'`),
  ],
);

// ---------- Returns ----------

// One row per return the customer starts. The trip back is planned at once (like a shipment),
// and the refund columns fill in once Stripe has been asked to pay the money back.
export const returnReason = pgEnum("return_reason", RETURN_REASONS);

export const returns = pgTable(
  "returns",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    reason: returnReason("reason").notNull(),
    note: text("note"),
    returnCode: text("return_code").notNull().unique(), // written on the parcel, like "RT-7KQ2XM"
    refundCents: integer("refund_cents").notNull(),
    includesShipping: boolean("includes_shipping").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    droppedOffAt: timestamp("dropped_off_at", { withTimezone: true }).notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull(),
    refundDueAt: timestamp("refund_due_at", { withTimezone: true }).notNull(),
    // null: not sent yet · "processing": being sent to Stripe right now · after that, Stripe's own
    // refund status: "pending", "requires_action", "succeeded", "failed" or "canceled".
    refundStatus: text("refund_status"),
    refundAttemptedAt: timestamp("refund_attempted_at", { withTimezone: true }),
    stripeRefundId: text("stripe_refund_id").unique(),
    refundedAt: timestamp("refunded_at", { withTimezone: true }),
    refundFailure: text("refund_failure"),
  },
  (table) => [
    check("returns_refund_positive", sql`${table.refundCents} > 0`),
    index("returns_order_id_idx").on(table.orderId),
    index("returns_user_id_idx").on(table.userId),
  ],
);

// The books in a return, with the price that was paid for them.
export const returnItems = pgTable(
  "return_items",
  {
    returnId: uuid("return_id")
      .notNull()
      .references(() => returns.id, { onDelete: "cascade" }),
    bookId: text("book_id").notNull(),
    title: text("title").notNull(),
    unitPriceCents: integer("unit_price_cents").notNull(),
    quantity: integer("quantity").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.returnId, table.bookId] }),
    check("return_items_quantity_positive", sql`${table.quantity} > 0`),
  ],
);

export type Return = typeof returns.$inferSelect;
