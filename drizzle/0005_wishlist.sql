CREATE TABLE "wishlist_items" (
	"user_id" text NOT NULL,
	"book_id" text NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "wishlist_items_user_id_book_id_pk" PRIMARY KEY("user_id","book_id"),
	CONSTRAINT "wishlist_items_book_id_format" CHECK ("wishlist_items"."book_id" ~ '^OL[0-9]+W$')
);
--> statement-breakpoint
ALTER TABLE "wishlist_items" ADD CONSTRAINT "wishlist_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;