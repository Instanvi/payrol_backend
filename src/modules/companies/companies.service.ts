import { and, eq } from "drizzle-orm"

import { AppError } from "../../common/errors/AppError"
import { cloudinaryService } from "../../common/services/cloudinary.service"
import { createId, nowIso } from "../../common/utils/id"
import { env } from "../../config/env"
import { db } from "../../db"
import { findOne } from "../../db/query"
import {
  companies,
  companyKycDocuments,
  companyReviewEvents,
  users,
} from "../../db/schema"
import type { CompanyStatus } from "../../common/services/company-approval.service"
import { notificationService } from "../notifications/notifications.service"

export type CompanyOnboardingStep = "profile" | "kyc" | "submitted" | "complete"

type KycDocumentRow = typeof companyKycDocuments.$inferSelect

function mapKycDocument(row: KycDocumentRow) {
  return {
    id: row.id,
    documentType: row.documentType,
    fileName: row.fileName,
    mimeType: row.mimeType,
    storageKey: row.storageKey,
    fileUrl:
      cloudinaryService.resolveDocumentUrl(row.storageKey, row.fileUrl) ??
      row.fileUrl ??
      undefined,
    createdAt: row.createdAt,
  }
}

function mapCompany(row: typeof companies.$inferSelect) {
  return {
    id: row.id,
    name: row.name,
    legalName: row.legalName ?? undefined,
    plan: row.plan,
    industry: row.industry ?? undefined,
    timezone: row.timezone ?? undefined,
    address: row.address ?? undefined,
    taxId: row.taxId ?? undefined,
    billingEmail: row.billingEmail ?? undefined,
    status: row.status as CompanyStatus,
    onboardingStep: row.onboardingStep as CompanyOnboardingStep,
    rejectionReason: row.rejectionReason ?? undefined,
    approvedAt: row.approvedAt ?? undefined,
    chargeId: row.chargeId ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export const companiesService = {
  async getById(companyId: string) {
    const row = await findOne(
      db.select().from(companies).where(eq(companies.id, companyId))
    )
    if (!row) throw AppError.notFound("Company not found")
    return mapCompany(row)
  },

  async updateProfile(
    companyId: string,
    input: {
      name?: string
      legalName?: string
      industry?: string
      timezone?: string
      address?: string
      taxId?: string
      billingEmail?: string
    }
  ) {
    const company = await this.getById(companyId)
    if (company.status === "approved" || company.status === "suspended") {
      throw AppError.validation("Approved companies cannot edit profile here")
    }

    const now = nowIso()
    await db
      .update(companies)
      .set({
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.legalName !== undefined ? { legalName: input.legalName } : {}),
        ...(input.industry !== undefined ? { industry: input.industry } : {}),
        ...(input.timezone !== undefined ? { timezone: input.timezone } : {}),
        ...(input.address !== undefined ? { address: input.address } : {}),
        ...(input.taxId !== undefined ? { taxId: input.taxId } : {}),
        ...(input.billingEmail !== undefined
          ? { billingEmail: input.billingEmail }
          : {}),
        onboardingStep: "kyc",
        updatedAt: now,
      })
      .where(eq(companies.id, companyId))

    return this.getById(companyId)
  },

  async listKycDocuments(companyId: string) {
    const rows = await db
      .select()
      .from(companyKycDocuments)
      .where(eq(companyKycDocuments.companyId, companyId))

    return rows.map(mapKycDocument)
  },

  async uploadKycDocument(
    companyId: string,
    userId: string,
    input: {
      documentType:
        | "business_registration"
        | "tax_certificate"
        | "director_id"
        | "bank_statement"
        | "other"
      fileName: string
      mimeType: string
      contentBase64: string
    }
  ) {
    const company = await this.getById(companyId)
    if (!["draft", "rejected"].includes(company.status)) {
      throw AppError.validation("KYC uploads are locked for this company status")
    }

    const buffer = Buffer.from(input.contentBase64, "base64")
    if (buffer.length === 0) {
      throw AppError.validation("Empty document content")
    }
    if (buffer.length > 5 * 1024 * 1024) {
      throw AppError.validation("Document exceeds 5MB limit")
    }

    const docId = createId()
    const upload = await cloudinaryService.uploadKycDocument({
      companyId,
      documentId: docId,
      fileName: input.fileName,
      buffer,
    })

    const now = nowIso()
    await db.insert(companyKycDocuments).values({
      id: docId,
      companyId,
      documentType: input.documentType,
      fileName: input.fileName,
      mimeType: input.mimeType,
      storageKey: upload.publicId,
      fileUrl: upload.secureUrl,
      uploadedByUserId: userId,
      createdAt: now,
    })

    await db
      .update(companies)
      .set({ onboardingStep: "kyc", updatedAt: now })
      .where(eq(companies.id, companyId))

    return {
      id: docId,
      documentType: input.documentType,
      fileName: input.fileName,
      mimeType: input.mimeType,
      fileUrl: upload.secureUrl,
      createdAt: now,
    }
  },

  async submitKyc(companyId: string, userId: string) {
    const company = await this.getById(companyId)
    if (!["draft", "rejected"].includes(company.status)) {
      throw AppError.validation("KYC already submitted or company is approved")
    }

    const docs = await this.listKycDocuments(companyId)
    const required = [
      "business_registration",
      "tax_certificate",
      "director_id",
    ] as const
    const uploadedTypes = new Set(docs.map((d) => d.documentType))
    const missing = required.filter((type) => !uploadedTypes.has(type))

    if (missing.length > 0) {
      throw AppError.validation(
        `Missing required KYC documents: ${missing.join(", ")}`
      )
    }

    if (!company.legalName || !company.taxId || !company.address) {
      throw AppError.validation(
        "Complete company profile (legal name, tax ID, address) before submitting KYC"
      )
    }

    const now = nowIso()
    await db
      .update(companies)
      .set({
        status: "pending_review",
        onboardingStep: "submitted",
        rejectionReason: null,
        updatedAt: now,
      })
      .where(eq(companies.id, companyId))

    await db.insert(companyReviewEvents).values({
      id: createId(),
      companyId,
      actorUserId: userId,
      action: "submitted",
      reason: null,
      metadata: JSON.stringify({ documentCount: docs.length }),
      createdAt: now,
    })

    const companyName = company.name
    await this.notifyCompanyOwners(companyId, {
      title: "KYC submitted for review",
      message: `We received your KYC documents for ${companyName}. A platform admin will review them and email you when your account is approved.`,
      type: "kyc_submitted",
      actionLabel: "View onboarding",
      actionUrl: `${env.APP_PUBLIC_URL}/onboarding`,
    })

    return this.getOnboardingStatus(companyId)
  },

  async getOnboardingStatus(companyId: string) {
    const company = await this.getById(companyId)
    const docs = await this.listKycDocuments(companyId)

    const required = [
      "business_registration",
      "tax_certificate",
      "director_id",
    ] as const
    const uploadedTypes = new Set(docs.map((d) => d.documentType))
    const missingDocuments = required.filter((type) => !uploadedTypes.has(type))

    return {
      company,
      documents: docs,
      missingDocuments,
      canSubmitKyc:
        missingDocuments.length === 0 &&
        Boolean(company.legalName && company.taxId && company.address) &&
        ["draft", "rejected"].includes(company.status),
      canMakePayments: company.status === "approved",
    }
  },

  async listForAdmin(status?: CompanyStatus) {
    const rows = status
      ? await db
          .select()
          .from(companies)
          .where(eq(companies.status, status))
      : await db.select().from(companies)

    return rows.map(mapCompany)
  },

  async notifyCompanyOwners(
    companyId: string,
    input: {
      title: string
      message: string
      type: "company_approved" | "company_rejected" | "kyc_submitted"
      actionLabel?: string
      actionUrl?: string
    }
  ) {
    const owners = await db
      .select()
      .from(users)
      .where(and(eq(users.companyId, companyId), eq(users.role, "owner")))

    for (const owner of owners) {
      await notificationService.sendInfoEmail({
        userId: owner.id,
        companyId,
        recipientEmail: owner.email,
        recipientName: owner.name,
        title: input.title,
        message: input.message,
        type: input.type,
        actionLabel: input.actionLabel,
        actionUrl: input.actionUrl,
      })
    }
  },

  async getAdminDetail(companyId: string) {
    const company = await this.getById(companyId)
    const docs = await this.listKycDocuments(companyId)
    const events = await db
      .select()
      .from(companyReviewEvents)
      .where(eq(companyReviewEvents.companyId, companyId))

    return { company, documents: docs, reviewEvents: events }
  },

  async approve(companyId: string, adminUserId: string, chargeId?: string) {
    const now = nowIso()
    await db
      .update(companies)
      .set({
        status: "approved",
        onboardingStep: "complete",
        approvedAt: now,
        approvedByUserId: adminUserId,
        rejectionReason: null,
        ...(chargeId ? { chargeId } : {}),
        updatedAt: now,
      })
      .where(eq(companies.id, companyId))

    await db.insert(companyReviewEvents).values({
      id: createId(),
      companyId,
      actorUserId: adminUserId,
      action: "approved",
      reason: null,
      metadata: chargeId ? JSON.stringify({ chargeId }) : null,
      createdAt: now,
    })

    const company = await this.getById(companyId)
    await this.notifyCompanyOwners(companyId, {
      title: "Your company is approved",
      message: `${company.name} has been approved. You can now run mobile money payroll. Platform transaction fees apply per disbursement.`,
      type: "company_approved",
      actionLabel: "Open dashboard",
      actionUrl: `${env.APP_PUBLIC_URL}/dashboard`,
    })

    return this.getAdminDetail(companyId)
  },

  async reject(companyId: string, adminUserId: string, reason: string) {
    const now = nowIso()
    await db
      .update(companies)
      .set({
        status: "rejected",
        onboardingStep: "kyc",
        rejectionReason: reason,
        updatedAt: now,
      })
      .where(eq(companies.id, companyId))

    await db.insert(companyReviewEvents).values({
      id: createId(),
      companyId,
      actorUserId: adminUserId,
      action: "rejected",
      reason,
      metadata: null,
      createdAt: now,
    })

    const company = await this.getById(companyId)
    await this.notifyCompanyOwners(companyId, {
      title: "Company onboarding needs updates",
      message: `${company.name} was not approved yet.\n\nReason: ${reason}\n\nPlease update your profile or KYC documents and submit again.`,
      type: "company_rejected",
      actionLabel: "Continue onboarding",
      actionUrl: `${env.APP_PUBLIC_URL}/onboarding`,
    })

    return this.getAdminDetail(companyId)
  },
}
