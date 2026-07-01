import { eq } from "drizzle-orm"

import { infoEmailTemplate, otpEmailTemplate } from "../../common/email/email-templates"
import { emailService } from "../../common/email/email.service"
import { createId, nowIso } from "../../common/utils/id"
import { db } from "../../db"
import { findOne } from "../../db/query"
import { notifications } from "../../db/schema"

export type NotificationType =
  | "otp"
  | "company_approved"
  | "company_rejected"
  | "kyc_submitted"
  | "payroll_info"
  | "member_invite"
  | "password_reset"
  | "general"

type CreateNotificationInput = {
  userId?: string
  companyId?: string
  type: NotificationType
  channel: "email" | "in_app"
  recipientEmail: string
  subject: string
  templateKey?: string
  bodyPreview?: string
  metadata?: Record<string, unknown>
}

export const notificationService = {
  async create(input: CreateNotificationInput) {
    const id = createId()
    const now = nowIso()

    await db.insert(notifications).values({
      id,
      userId: input.userId ?? null,
      companyId: input.companyId ?? null,
      type: input.type,
      channel: input.channel,
      status: "pending",
      recipientEmail: input.recipientEmail,
      subject: input.subject,
      templateKey: input.templateKey ?? null,
      bodyPreview: input.bodyPreview ?? null,
      metadata: input.metadata ? JSON.stringify(input.metadata) : null,
      provider: emailService.isConfigured() ? "resend" : "console",
      providerMessageId: null,
      errorMessage: null,
      sentAt: null,
      readAt: null,
      createdAt: now,
    })

    return id
  },

  async markSent(
    notificationId: string,
    result: { provider: "resend" | "console"; messageId?: string }
  ) {
    await db
      .update(notifications)
      .set({
        status: "sent",
        provider: result.provider,
        providerMessageId: result.messageId ?? null,
        sentAt: nowIso(),
        errorMessage: null,
      })
      .where(eq(notifications.id, notificationId))
  },

  async markFailed(notificationId: string, errorMessage: string) {
    await db
      .update(notifications)
      .set({
        status: "failed",
        errorMessage,
      })
      .where(eq(notifications.id, notificationId))
  },

  async sendOtpEmail(input: {
    userId: string
    companyId?: string
    recipientEmail: string
    recipientName: string
    code: string
    expiresMinutes: number
  }) {
    const template = otpEmailTemplate({
      recipientName: input.recipientName,
      code: input.code,
      expiresMinutes: input.expiresMinutes,
    })

    const notificationId = await this.create({
      userId: input.userId,
      companyId: input.companyId,
      type: "otp",
      channel: "email",
      recipientEmail: input.recipientEmail,
      subject: template.subject,
      templateKey: "otp",
      bodyPreview: template.preview,
      metadata: { purpose: "login" },
    })

    try {
      const result = await emailService.send({
        to: input.recipientEmail,
        subject: template.subject,
        html: template.html,
        text: template.text,
      })
      await this.markSent(notificationId, result)
      return notificationId
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to send OTP email"
      await this.markFailed(notificationId, message)
      throw error
    }
  },

  async sendMemberInviteEmail(input: {
    userId: string
    companyId: string
    recipientEmail: string
    recipientName: string
    companyName: string
    inviterName: string
    role: string
    inviteUrl: string
  }) {
    const message = `${input.inviterName} invited you to join ${input.companyName} on Instanvi Payroll as ${input.role}. Accept the invitation to set your password and access the company workspace. This link expires in 7 days.`

    return this.sendInfoEmail({
      userId: input.userId,
      companyId: input.companyId,
      recipientEmail: input.recipientEmail,
      recipientName: input.recipientName,
      title: `You're invited to ${input.companyName}`,
      message,
      type: "member_invite",
      actionLabel: "Accept invitation",
      actionUrl: input.inviteUrl,
      metadata: { role: input.role, companyName: input.companyName },
    })
  },

  async sendPasswordResetEmail(input: {
    userId: string
    companyId?: string
    recipientEmail: string
    recipientName: string
    resetUrl: string
  }) {
    const message =
      "We received a request to reset your Instanvi Payroll password. Use the button below to choose a new password. This link expires in 1 hour. If you did not request a reset, you can ignore this email."

    return this.sendInfoEmail({
      userId: input.userId,
      companyId: input.companyId,
      recipientEmail: input.recipientEmail,
      recipientName: input.recipientName,
      title: "Reset your password",
      message,
      type: "password_reset",
      actionLabel: "Reset password",
      actionUrl: input.resetUrl,
      metadata: { purpose: "password_reset" },
    })
  },

  async sendInfoEmail(input: {
    userId?: string
    companyId?: string
    recipientEmail: string
    recipientName: string
    title: string
    message: string
    type?: NotificationType
    actionLabel?: string
    actionUrl?: string
    metadata?: Record<string, unknown>
  }) {
    const template = infoEmailTemplate({
      recipientName: input.recipientName,
      title: input.title,
      message: input.message,
      actionLabel: input.actionLabel,
      actionUrl: input.actionUrl,
    })

    const notificationId = await this.create({
      userId: input.userId,
      companyId: input.companyId,
      type: input.type ?? "general",
      channel: "email",
      recipientEmail: input.recipientEmail,
      subject: template.subject,
      templateKey: "info",
      bodyPreview: template.preview,
      metadata: input.metadata,
    })

    try {
      const result = await emailService.send({
        to: input.recipientEmail,
        subject: template.subject,
        html: template.html,
        text: template.text,
      })
      await this.markSent(notificationId, result)
      return notificationId
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to send email"
      await this.markFailed(notificationId, message)
      throw error
    }
  },

  async listForUser(userId: string, limit = 20) {
    return db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .limit(limit)
  },

  async getById(id: string) {
    const row = await findOne(
      db.select().from(notifications).where(eq(notifications.id, id))
    )
    return row ?? null
  },
}
