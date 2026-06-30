import { createHash } from "node:crypto";

import { and, eq } from "drizzle-orm";

import { AppError } from "../errors/AppError";
import { createId, nowIso } from "../utils/id";
import { db } from "../../db";
import { findOne } from "../../db/query";
import { idempotencyKeys } from "../../db/schema";
import { paymentLogService } from "../logging/payment-log.service";

const TTL_MS = 24 * 60 * 60 * 1000;

export type IdempotencyOperation =
  | "mobile_disburse"
  | "mobile_collect"
  | "payroll_bulk_disburse";

function hashPayload(payload: unknown) {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

function expiryIso() {
  return new Date(Date.now() + TTL_MS).toISOString();
}

export const idempotencyService = {
  hashPayload,

  async begin(params: {
    companyId: string;
    key: string;
    operation: IdempotencyOperation;
    payload: unknown;
  }) {
    const requestHash = hashPayload(params.payload);
    const existing = await findOne(
      db
        .select()
        .from(idempotencyKeys)
        .where(
          and(
            eq(idempotencyKeys.companyId, params.companyId),
            eq(idempotencyKeys.key, params.key),
          ),
        ),
    );

    if (existing) {
      if (existing.requestHash !== requestHash) {
        throw AppError.validation(
          "Idempotency-Key was already used with a different request body",
        );
      }

      if (existing.status === "completed" && existing.responseBody) {
        await paymentLogService.info({
          companyId: params.companyId,
          event: "idempotency.replay",
          message: `Replayed idempotent response for ${params.operation}`,
          metadata: { key: params.key, operation: params.operation },
        });

        return {
          replay: true as const,
          statusCode: existing.statusCode ?? 200,
          body: JSON.parse(existing.responseBody) as unknown,
        };
      }

      if (existing.status === "processing") {
        return {
          replay: true as const,
          statusCode: 409,
          body: {
            status: "processing",
            message:
              "A request with this Idempotency-Key is already in progress",
          },
        };
      }

      if (existing.status === "failed") {
        await db
          .update(idempotencyKeys)
          .set({
            status: "processing",
            requestHash,
            responseBody: null,
            statusCode: null,
            expiresAt: expiryIso(),
          })
          .where(eq(idempotencyKeys.id, existing.id));

        return { replay: false as const, requestHash };
      }
    }

    const now = nowIso();
    await db.insert(idempotencyKeys).values({
      id: createId(),
      companyId: params.companyId,
      key: params.key,
      operation: params.operation,
      requestHash,
      responseBody: null,
      statusCode: null,
      status: "processing",
      createdAt: now,
      expiresAt: expiryIso(),
    });

    await paymentLogService.info({
      companyId: params.companyId,
      event: "idempotency.begin",
      message: `Started idempotent ${params.operation}`,
      metadata: { key: params.key },
    });

    return { replay: false as const, requestHash };
  },

  async complete(params: {
    companyId: string;
    key: string;
    statusCode: number;
    body: unknown;
  }) {
    await db
      .update(idempotencyKeys)
      .set({
        status: "completed",
        statusCode: params.statusCode,
        responseBody: JSON.stringify(params.body),
      })
      .where(
        and(
          eq(idempotencyKeys.companyId, params.companyId),
          eq(idempotencyKeys.key, params.key),
        ),
      );
  },

  async fail(params: { companyId: string; key: string; body: unknown }) {
    await db
      .update(idempotencyKeys)
      .set({
        status: "failed",
        statusCode: 422,
        responseBody: JSON.stringify(params.body),
      })
      .where(
        and(
          eq(idempotencyKeys.companyId, params.companyId),
          eq(idempotencyKeys.key, params.key),
        ),
      );
  },
};
