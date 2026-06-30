import { eq } from "drizzle-orm"

import { AppError } from "../errors/AppError"
import { db } from "../../db"
import { findOne } from "../../db/query"
import { companies } from "../../db/schema"

export type CompanyStatus =
  | "draft"
  | "pending_review"
  | "approved"
  | "rejected"
  | "suspended"

export const companyApprovalService = {
  async getCompanyRow(companyId: string) {
    const company = await findOne(
      db.select().from(companies).where(eq(companies.id, companyId))
    )
    if (!company) throw AppError.notFound("Company not found")
    return company
  },

  async assertCanMakePayments(companyId: string) {
    const company = await this.getCompanyRow(companyId)

    if (company.status === "approved") return company

    if (company.status === "pending_review") {
      throw new AppError(
        "Company is pending review. Payments are disabled until a system admin approves your account.",
        403,
        "COMPANY_PENDING_REVIEW"
      )
    }

    if (company.status === "rejected") {
      throw new AppError(
        company.rejectionReason ??
          "Company onboarding was rejected. Update KYC and resubmit.",
        403,
        "COMPANY_REJECTED"
      )
    }

    if (company.status === "suspended") {
      throw new AppError(
        "Company account is suspended. Contact support.",
        403,
        "COMPANY_SUSPENDED"
      )
    }

    throw new AppError(
      "Complete company onboarding and KYC before running payments.",
      403,
      "COMPANY_NOT_APPROVED"
    )
  },
}
