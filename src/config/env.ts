import path from "node:path";

import dotenv from "dotenv";
import { z } from "zod";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z
    .string()
    .default("postgresql://payroll:payroll@localhost:5432/payroll"),
  CORS_ORIGIN: z.string().default("http://localhost:3000"),
  DEFAULT_COMPANY_ID: z
    .string()
    .uuid()
    .default("a0000001-0000-4000-8000-000000000001"),
  JWT_SECRET: z.string().default("dev-jwt-secret-change-in-production"),
  JWT_EXPIRES_IN: z.string().default("7d"),
  DEMO_2FA_CODE: z.string().default("123456"),
  DEMO_PASSWORD: z.string().default("password123"),
  SEED_ADMIN_EMAIL: z.string().email().default("admin@platform.com"),
  SEED_ADMIN_PASSWORD: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM_EMAIL: z
    .string()
    .default("Instanvi Payroll <noreply@instanvi.com>"),
  APP_PUBLIC_URL: z.string().url().default("http://localhost:3000"),
  INSTANVI_PAYMENTS_BASE_URL: z
    .string()
    .default("http://localhost:3001/api/integration/payments"),
  INSTANVI_API_KEY: z.string().optional(),
  INSTANVI_LOCATION_ID: z.string().optional(),
  INTEGRATION_ENCRYPTION_KEY: z
    .string()
    .default("dev-integration-encryption-key-32b!"),
  INSTANVI_CALLBACK_URL: z
    .string()
    .default("http://localhost:4000/api/payments/mobile/webhook"),
  REDIS_URL: z.string().default("redis://localhost:6379"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  PAYMENT_QUEUE_ATTEMPTS: z.coerce.number().default(3),
  PAYMENT_QUEUE_CONCURRENCY: z.coerce.number().default(5),
  RUN_PAYMENT_WORKER: z
    .enum(["true", "false"])
    .default("true")
    .transform((value) => value === "true"),
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
  CLOUDINARY_KYC_FOLDER: z.string().default("instanvi/kyc"),
});

export const env = envSchema.parse(process.env);
