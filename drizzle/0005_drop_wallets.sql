ALTER TABLE "mobile_payment_transactions" DROP CONSTRAINT IF EXISTS "mobile_payment_transactions_wallet_id_wallets_id_fk";--> statement-breakpoint
ALTER TABLE "mobile_payment_transactions" DROP COLUMN IF EXISTS "wallet_id";--> statement-breakpoint
DROP TABLE IF EXISTS "wallets";
