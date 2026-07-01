ALTER TABLE "companies" ADD COLUMN "instanvi_api_key_encrypted" text;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "instanvi_api_key_last4" text;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "instanvi_location_id" text;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "instanvi_connected_at" timestamp with time zone;
