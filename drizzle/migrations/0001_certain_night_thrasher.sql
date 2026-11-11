CREATE TABLE "blob_upload_rate_limits" (
	"id" serial PRIMARY KEY NOT NULL,
	"subject_hash" varchar(64) NOT NULL,
	"bucket_key" varchar(48) NOT NULL,
	"upload_count" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "blob_upload_rate_limits_subject_bucket_unique" ON "blob_upload_rate_limits" USING btree ("subject_hash","bucket_key");--> statement-breakpoint
CREATE INDEX "blob_upload_rate_limits_updated_idx" ON "blob_upload_rate_limits" USING btree ("updated_at");