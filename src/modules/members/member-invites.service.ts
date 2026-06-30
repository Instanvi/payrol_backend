import { randomBytes } from "node:crypto"

import { and, eq, gt, isNull } from "drizzle-orm"

import { AppError } from "../../common/errors/AppError"
import { createId, nowIso } from "../../common/utils/id"
import { env } from "../../config/env"
import { db } from "../../db/index"
import { findOne } from "../../db/query"
import { memberInvites } from "../../db/schema/index"

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000

function inviteExpiry() {
  return new Date(Date.now() + INVITE_TTL_MS).toISOString()
}

function createInviteToken() {
  return randomBytes(32).toString("hex")
}

export const memberInvitesService = {
  buildInviteUrl(token: string) {
    return `${env.APP_PUBLIC_URL}/invite/accept?token=${token}`
  },

  async createInvite(input: {
    userId: string
    companyId: string
    invitedByUserId?: string
  }) {
    const now = nowIso()

    await db
      .delete(memberInvites)
      .where(
        and(
          eq(memberInvites.userId, input.userId),
          isNull(memberInvites.acceptedAt)
        )
      )

    const token = createInviteToken()

    await db.insert(memberInvites).values({
      id: createId(),
      userId: input.userId,
      companyId: input.companyId,
      invitedByUserId: input.invitedByUserId ?? null,
      token,
      expiresAt: inviteExpiry(),
      acceptedAt: null,
      createdAt: now,
    })

    if (env.NODE_ENV !== "production") {
      console.info(
        `[auth:invite] user=${input.userId} → ${this.buildInviteUrl(token)}`
      )
    }

    return token
  },

  async getValidInvite(token: string) {
    const invite = await findOne(
      db
        .select()
        .from(memberInvites)
        .where(
          and(
            eq(memberInvites.token, token),
            isNull(memberInvites.acceptedAt),
            gt(memberInvites.expiresAt, nowIso())
          )
        )
    )

    if (!invite) {
      throw new AppError(
        "This invitation is invalid or has expired.",
        404,
        "INVITE_EXPIRED"
      )
    }

    return invite
  },

  async markAccepted(inviteId: string) {
    await db
      .update(memberInvites)
      .set({ acceptedAt: nowIso() })
      .where(eq(memberInvites.id, inviteId))
  },
}
