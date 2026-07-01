import { randomBytes } from "node:crypto"

import { and, eq, gt, isNull } from "drizzle-orm"

import { AppError } from "../../common/errors/AppError"
import { createId, nowIso } from "../../common/utils/id"
import { env } from "../../config/env"
import { db } from "../../db/index"
import { findOne } from "../../db/query"
import { passwordResetTokens } from "../../db/schema/index"

const RESET_TTL_MS = 60 * 60 * 1000

function resetExpiry() {
  return new Date(Date.now() + RESET_TTL_MS).toISOString()
}

function createResetToken() {
  return randomBytes(32).toString("hex")
}

export const passwordResetService = {
  buildResetUrl(token: string) {
    return `${env.APP_PUBLIC_URL}/reset-password?token=${token}`
  },

  async createToken(userId: string) {
    const now = nowIso()

    await db
      .delete(passwordResetTokens)
      .where(
        and(
          eq(passwordResetTokens.userId, userId),
          isNull(passwordResetTokens.usedAt)
        )
      )

    const token = createResetToken()

    await db.insert(passwordResetTokens).values({
      id: createId(),
      userId,
      token,
      expiresAt: resetExpiry(),
      usedAt: null,
      createdAt: now,
    })

    if (env.NODE_ENV !== "production") {
      console.info(
        `[auth:password-reset] user=${userId} → ${this.buildResetUrl(token)}`
      )
    }

    return token
  },

  async getValidToken(token: string) {
    const row = await findOne(
      db
        .select()
        .from(passwordResetTokens)
        .where(
          and(
            eq(passwordResetTokens.token, token),
            isNull(passwordResetTokens.usedAt),
            gt(passwordResetTokens.expiresAt, nowIso())
          )
        )
    )

    if (!row) {
      throw new AppError(
        "This password reset link is invalid or has expired.",
        404,
        "RESET_TOKEN_EXPIRED"
      )
    }

    return row
  },

  async markUsed(tokenId: string) {
    await db
      .update(passwordResetTokens)
      .set({ usedAt: nowIso() })
      .where(eq(passwordResetTokens.id, tokenId))
  },
}
