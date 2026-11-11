ALTER TABLE "blob_upload_rate_limits" RENAME TO "public_action_rate_limits";--> statement-breakpoint
ALTER TABLE "public_action_rate_limits" RENAME COLUMN "upload_count" TO "action_count";--> statement-breakpoint
DROP INDEX "blob_upload_rate_limits_subject_bucket_unique";--> statement-breakpoint
DROP INDEX "blob_upload_rate_limits_updated_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "public_action_rate_limits_subject_bucket_unique" ON "public_action_rate_limits" USING btree ("subject_hash","bucket_key");--> statement-breakpoint
CREATE INDEX "public_action_rate_limits_updated_idx" ON "public_action_rate_limits" USING btree ("updated_at");