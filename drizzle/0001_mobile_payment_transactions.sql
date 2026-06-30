ALTER TABLE "momo_transactions" RENAME TO "mobile_payment_transactions";--> statement-breakpoint
ALTER TABLE "mobile_payment_transactions" RENAME COLUMN "momo_status" TO "provider_status";--> statement-breakpoint
ALTER TABLE "mobile_payment_transactions" ADD COLUMN "provider" text;--> statement-breakpoint
UPDATE "mobile_payment_transactions" SET "provider" = 'MTN_CAM' WHERE "provider" IS NULL;--> statement-breakpoint
ALTER TABLE "payment_logs" RENAME COLUMN "momo_transaction_id" TO "mobile_payment_transaction_id";
