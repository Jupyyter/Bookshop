CREATE TYPE "public"."return_reason" AS ENUM('changed_mind', 'damaged', 'wrong_item', 'arrived_late', 'other');--> statement-breakpoint
CREATE TABLE "return_items" (
	"return_id" uuid NOT NULL,
	"book_id" text NOT NULL,
	"title" text NOT NULL,
	"unit_price_cents" integer NOT NULL,
	"quantity" integer NOT NULL,
	CONSTRAINT "return_items_return_id_book_id_pk" PRIMARY KEY("return_id","book_id"),
	CONSTRAINT "return_items_quantity_positive" CHECK ("return_items"."quantity" > 0)
);
--> statement-breakpoint
CREATE TABLE "returns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"reason" "return_reason" NOT NULL,
	"note" text,
	"return_code" text NOT NULL,
	"refund_cents" integer NOT NULL,
	"includes_shipping" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"dropped_off_at" timestamp with time zone NOT NULL,
	"received_at" timestamp with time zone NOT NULL,
	"refund_due_at" timestamp with time zone NOT NULL,
	"refund_status" text,
	"refund_attempted_at" timestamp with time zone,
	"stripe_refund_id" text,
	"refunded_at" timestamp with time zone,
	"refund_failure" text,
	CONSTRAINT "returns_return_code_unique" UNIQUE("return_code"),
	CONSTRAINT "returns_stripe_refund_id_unique" UNIQUE("stripe_refund_id"),
	CONSTRAINT "returns_refund_positive" CHECK ("returns"."refund_cents" > 0)
);
--> statement-breakpoint
ALTER TABLE "return_items" ADD CONSTRAINT "return_items_return_id_returns_id_fk" FOREIGN KEY ("return_id") REFERENCES "public"."returns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "returns" ADD CONSTRAINT "returns_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "returns" ADD CONSTRAINT "returns_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "returns_order_id_idx" ON "returns" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "returns_user_id_idx" ON "returns" USING btree ("user_id");