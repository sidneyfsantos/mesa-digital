ALTER TABLE "bill_requests" ADD COLUMN "requested_by" uuid;--> statement-breakpoint
ALTER TABLE "service_calls" ADD COLUMN "requested_by" uuid;--> statement-breakpoint
UPDATE "bill_requests" SET "requested_by" = '00000000-0000-0000-0000-000000000000' WHERE "requested_by" IS NULL;--> statement-breakpoint
UPDATE "service_calls" SET "requested_by" = '00000000-0000-0000-0000-000000000000' WHERE "requested_by" IS NULL;--> statement-breakpoint
ALTER TABLE "bill_requests" ALTER COLUMN "requested_by" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "service_calls" ALTER COLUMN "requested_by" SET NOT NULL;