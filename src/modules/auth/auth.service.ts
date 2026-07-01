import { randomBytes } from "node:crypto"

import { and, eq, gt } from "drizzle-orm"

import { AppError } from "../../common/errors/AppError"
import { createId, nowIso } from "../../common/utils/id"
import {
  generateOtpCode,
  hashOtpCode,
  verifyOtpCode,
} from "../../common/utils/otp"
import { hashPassword, verifyPassword } from "../../common/utils/password"
import { signAccessToken } from "../../common/utils/jwt"
import { env } from "../../config/env"
import { db } from "../../db/index"
import { findOne } from "../../db/query"
import { authChallenges, companies, users } from "../../db/schema/index"
import { notificationService } from "../notifications/notifications.service"
import { memberInvitesService } from "../members/member-invites.service"
import { passwordResetService } from "./password-reset.service"
import { usersService } from "../users/users.service"
import type {
  AcceptInviteInput,
  ForgotPasswordInput,
  LoginInput,
  RegisterInput,
  ResetPasswordInput,
  Verify2FAInput,
} from "./auth.validation"

const CHALLENGE_TTL_MS = 10 * 60 * 1000
const OTP_EXPIRES_MINUTES = 10

function createChallengeToken() {
  return randomBytes(32).toString("hex")
}

function challengeExpiry() {
  return new Date(Date.now() + CHALLENGE_TTL_MS).toISOString()
}

function logDevOtp(email: string, code: string, context: "login" | "resend") {
  if (env.NODE_ENV === "production") return

  console.info(
    `[auth:otp:${context}] ${email} → ${code} (expires in ${OTP_EXPIRES_MINUTES} minutes)`
  )
}

async function buildSession(userId: string) {
  const session = await usersService.getSessionByUserId(userId)
  const user = await usersService.getById(userId)
  const accessToken = signAccessToken({
    userId: session.user.id,
    companyId: user.companyId ?? null,
    email: session.user.email,
    role: session.user.role,
    isSystemAdmin: session.user.isSystemAdmin,
  })
  return { accessToken, session }
}

async function issueLoginChallenge(user: typeof users.$inferSelect) {
  const token = createChallengeToken()
  const now = nowIso()
  const code = generateOtpCode()
  const otpCodeHash = await hashOtpCode(code)

  logDevOtp(user.email, code, "login")

  await db.delete(authChallenges).where(eq(authChallenges.userId, user.id))

  const challengeId = createId()

  const notificationId = await notificationService.sendOtpEmail({
    userId: user.id,
    companyId: user.companyId ?? undefined,
    recipientEmail: user.email,
    recipientName: user.name,
    code,
    expiresMinutes: OTP_EXPIRES_MINUTES,
  })

  await db.insert(authChallenges).values({
    id: challengeId,
    userId: user.id,
    token,
    purpose: "login",
    otpCodeHash,
    otpAttempts: 0,
    maxOtpAttempts: 5,
    expiresAt: challengeExpiry(),
    lastSentAt: now,
    notificationId,
    createdAt: now,
  })

  return { requires2FA: true as const, challengeToken: token }
}

export const authService = {
  async register(input: RegisterInput) {
    const existing = await findOne(
      db
        .select()
        .from(users)
        .where(eq(users.email, input.email.toLowerCase()))
    )
    if (existing) {
      throw AppError.duplicate("An account with this email already exists")
    }

    const now = nowIso()
    const companyId = createId()
    const userId = createId()
    const passwordHash = await hashPassword(input.password)

    await db.insert(companies).values({
      id: companyId,
      name: input.companyName,
      plan: "starter",
      status: "draft",
      onboardingStep: "profile",
      createdAt: now,
      updatedAt: now,
    })

    const user = {
      id: userId,
      companyId,
      name: input.name,
      email: input.email.toLowerCase(),
      passwordHash,
      role: "owner" as const,
      isSystemAdmin: false,
      status: "active" as const,
    }

    await db.insert(users).values({
      ...user,
      avatar: null,
      phone: null,
      lastLoginAt: null,
      createdAt: now,
      updatedAt: now,
    })

    return issueLoginChallenge(user as typeof users.$inferSelect)
  },

  async login(input: LoginInput) {
    const user = await findOne(
      db
        .select()
        .from(users)
        .where(eq(users.email, input.email.toLowerCase()))
    )

    if (!user || !user.passwordHash || user.status === "inactive") {
      throw new AppError("Invalid email or password", 401, "INVALID_CREDENTIALS")
    }

    const valid = await verifyPassword(input.password, user.passwordHash)
    if (!valid) {
      throw new AppError("Invalid email or password", 401, "INVALID_CREDENTIALS")
    }

    return issueLoginChallenge(user)
  },

  async verify2FA(input: Verify2FAInput) {
    const challenge = await findOne(
      db
        .select()
        .from(authChallenges)
        .where(
          and(
            eq(authChallenges.token, input.challengeToken),
            gt(authChallenges.expiresAt, nowIso())
          )
        )
    )

    if (!challenge) {
      throw new AppError(
        "Session expired. Please log in again.",
        401,
        "SESSION_EXPIRED"
      )
    }

    if (challenge.otpAttempts >= challenge.maxOtpAttempts) {
      await db
        .delete(authChallenges)
        .where(eq(authChallenges.id, challenge.id))
      throw new AppError(
        "Too many invalid attempts. Please log in again.",
        401,
        "OTP_ATTEMPTS_EXCEEDED"
      )
    }

    const valid = await verifyOtpCode(input.code, challenge.otpCodeHash)

    if (!valid) {
      await db
        .update(authChallenges)
        .set({ otpAttempts: challenge.otpAttempts + 1 })
        .where(eq(authChallenges.id, challenge.id))

      throw new AppError("Invalid verification code", 401, "INVALID_2FA")
    }

    await db
      .delete(authChallenges)
      .where(eq(authChallenges.id, challenge.id))

    const now = nowIso()
    await db
      .update(users)
      .set({ lastLoginAt: now, updatedAt: now })
      .where(eq(users.id, challenge.userId))

    return buildSession(challenge.userId)
  },

  async resend2FA(challengeToken: string) {
    const challenge = await findOne(
      db
        .select()
        .from(authChallenges)
        .where(eq(authChallenges.token, challengeToken))
    )

    if (!challenge || challenge.expiresAt <= nowIso()) {
      throw new AppError(
        "Session expired. Please log in again.",
        401,
        "SESSION_EXPIRED"
      )
    }

    const user = await findOne(
      db.select().from(users).where(eq(users.id, challenge.userId))
    )

    if (!user) {
      throw new AppError(
        "Session expired. Please log in again.",
        401,
        "SESSION_EXPIRED"
      )
    }

    const code = generateOtpCode()
    const otpCodeHash = await hashOtpCode(code)
    const now = nowIso()

    logDevOtp(user.email, code, "resend")

    const notificationId = await notificationService.sendOtpEmail({
      userId: user.id,
      companyId: user.companyId ?? undefined,
      recipientEmail: user.email,
      recipientName: user.name,
      code,
      expiresMinutes: OTP_EXPIRES_MINUTES,
    })

    await db
      .update(authChallenges)
      .set({
        otpCodeHash,
        otpAttempts: 0,
        expiresAt: challengeExpiry(),
        lastSentAt: now,
        notificationId,
      })
      .where(eq(authChallenges.id, challenge.id))

    return { message: "Verification code resent" }
  },

  getMe(userId: string) {
    return usersService.getSessionByUserId(userId)
  },

  async getInvitePreview(token: string) {
    const invite = await memberInvitesService.getValidInvite(token)
    const user = await findOne(
      db.select().from(users).where(eq(users.id, invite.userId))
    )

    if (!user || user.status !== "invited") {
      throw new AppError(
        "This invitation is no longer valid.",
        404,
        "INVITE_EXPIRED"
      )
    }

    const company = await findOne(
      db.select().from(companies).where(eq(companies.id, invite.companyId))
    )

    if (!company) {
      throw AppError.notFound("Company not found")
    }

    return {
      email: user.email,
      name: user.name,
      role: user.role,
      companyName: company.name,
      expiresAt: invite.expiresAt,
    }
  },

  async acceptInvite(input: AcceptInviteInput) {
    const invite = await memberInvitesService.getValidInvite(input.token)
    const user = await findOne(
      db.select().from(users).where(eq(users.id, invite.userId))
    )

    if (!user || user.status !== "invited") {
      throw new AppError(
        "This invitation is no longer valid.",
        404,
        "INVITE_EXPIRED"
      )
    }

    const passwordHash = await hashPassword(input.password)
    const now = nowIso()

    await db
      .update(users)
      .set({
        name: input.name?.trim() || user.name,
        passwordHash,
        status: "active",
        updatedAt: now,
      })
      .where(eq(users.id, user.id))

    await memberInvitesService.markAccepted(invite.id)

    const updatedUser = {
      ...user,
      name: input.name?.trim() || user.name,
      passwordHash,
      status: "active" as const,
    }

    return issueLoginChallenge(updatedUser)
  },

  async forgotPassword(input: ForgotPasswordInput) {
    const user = await findOne(
      db
        .select()
        .from(users)
        .where(eq(users.email, input.email.toLowerCase()))
    )

    if (
      user &&
      user.status === "active" &&
      user.passwordHash &&
      !user.isSystemAdmin
    ) {
      const token = await passwordResetService.createToken(user.id)
      const resetUrl = passwordResetService.buildResetUrl(token)

      await notificationService.sendPasswordResetEmail({
        userId: user.id,
        companyId: user.companyId ?? undefined,
        recipientEmail: user.email,
        recipientName: user.name,
        resetUrl,
      })
    }

    return {
      message:
        "If an account exists for that email, we sent password reset instructions.",
    }
  },

  async getResetPreview(token: string) {
    const reset = await passwordResetService.getValidToken(token)
    const user = await findOne(
      db.select().from(users).where(eq(users.id, reset.userId))
    )

    if (!user || user.status !== "active" || !user.passwordHash) {
      throw new AppError(
        "This password reset link is invalid or has expired.",
        404,
        "RESET_TOKEN_EXPIRED"
      )
    }

    return {
      email: user.email,
      name: user.name,
      expiresAt: reset.expiresAt,
    }
  },

  async resetPassword(input: ResetPasswordInput) {
    const reset = await passwordResetService.getValidToken(input.token)
    const user = await findOne(
      db.select().from(users).where(eq(users.id, reset.userId))
    )

    if (!user || user.status !== "active" || !user.passwordHash) {
      throw new AppError(
        "This password reset link is invalid or has expired.",
        404,
        "RESET_TOKEN_EXPIRED"
      )
    }

    const passwordHash = await hashPassword(input.password)
    const now = nowIso()

    await db
      .update(users)
      .set({ passwordHash, updatedAt: now })
      .where(eq(users.id, user.id))

    await passwordResetService.markUsed(reset.id)
    await db.delete(authChallenges).where(eq(authChallenges.userId, user.id))

    return { message: "Password updated successfully. You can sign in now." }
  },
}
