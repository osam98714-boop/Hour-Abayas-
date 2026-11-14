CREATE TABLE "store_announcements" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar(140) NOT NULL,
	"message" text NOT NULL,
	"image_url" text,
	"link_label" varchar(60),
	"link_url" text,
	"active" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "latitude" double precision;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "longitude" double precision;--> statement-breakpoint
CREATE INDEX "store_announcements_active_updated_idx" ON "store_announcements" USING btree ("active","updated_at");