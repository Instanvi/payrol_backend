import { and, eq, inArray } from "drizzle-orm"

import { paymentLogService } from "../../common/logging/payment-log.service"
import { AppError } from "../../common/errors/AppError"
import {
  detectCarrier,
  type MobileCarrier,
} from "../../common/utils/phone-carrier"
import { nowIso } from "../../common/utils/id"
import { env } from "../../config/env"
import { db } from "../../db"
import { findOne } from "../../db/query"
import { employees } from "../../db/schema"
import { checkMobileAccount } from "../mobile-payments/account-verification.service"
import { isMobileMoneyCarrier } from "../mobile-payments/provider.utils"

export interface EmployeeAccountValidation {
  employeeId: string
  name: string
  phone: string | null
  carrier: MobileCarrier | null
  accountValid: boolean | null
  mobileEligible: boolean
  validatedAt: string | null
  error: string | null
  accountHolderName?: string | null
  verificationScope?: "provider_api" | "network_prefix_only"
}

async function persistValidation(
  employeeId: string,
  companyId: string,
  result: {
    carrier: MobileCarrier | null
    accountValid: boolean
    error: string | null
    accountHolderName?: string | null
  }
) {
  const now = nowIso()
  await db
    .update(employees)
    .set({
      mobileCarrier: result.carrier,
      mobileAccountValid: result.accountValid,
      mobileAccountValidatedAt: now,
      mobileAccountValidationError: result.error,
      mobileAccountHolderName: result.accountHolderName ?? null,
      updatedAt: now,
    })
    .where(and(eq(employees.id, employeeId), eq(employees.companyId, companyId)))
}

export const employeesAccountService = {
  async validateEmployee(
    employeeId: string,
    companyId = env.DEFAULT_COMPANY_ID
  ): Promise<EmployeeAccountValidation> {
    const row = await findOne(
      db
        .select()
        .from(employees)
        .where(and(eq(employees.id, employeeId), eq(employees.companyId, companyId)))
    )

    if (!row) throw AppError.notFound("Employee not found")

    if (!row.phone?.trim()) {
      const result = {
        carrier: null as MobileCarrier | null,
        accountValid: false,
        error: "No phone number on file",
        accountHolderName: null,
      }
      await persistValidation(employeeId, companyId, result)
      return {
        employeeId: row.id,
        name: row.name,
        phone: null,
        carrier: null,
        accountValid: false,
        mobileEligible: false,
        validatedAt: nowIso(),
        error: result.error,
      }
    }

    const parsed = detectCarrier(row.phone)

    if (!parsed.valid) {
      const result = {
        carrier: parsed.carrier,
        accountValid: false,
        error: parsed.error ?? "Invalid phone number format",
        accountHolderName: null,
      }
      await persistValidation(employeeId, companyId, result)
      return {
        employeeId: row.id,
        name: row.name,
        phone: parsed.national,
        carrier: parsed.carrier,
        accountValid: false,
        mobileEligible: false,
        validatedAt: nowIso(),
        error: result.error,
      }
    }

    if (!isMobileMoneyCarrier(parsed.carrier)) {
      const result = {
        carrier: parsed.carrier,
        accountValid: false,
        error: `Carrier ${parsed.carrier} is not supported for mobile money payroll`,
        accountHolderName: null,
      }
      await persistValidation(employeeId, companyId, result)
      return {
        employeeId: row.id,
        name: row.name,
        phone: parsed.national,
        carrier: parsed.carrier,
        accountValid: false,
        mobileEligible: false,
        validatedAt: nowIso(),
        error: result.error,
      }
    }

    const verification = await checkMobileAccount(companyId, row.phone, "DEPOSIT")

    if (!verification.ok) {
      const result = {
        carrier: verification.carrier ?? parsed.carrier,
        accountValid: false,
        error: verification.error ?? "Mobile money account verification failed",
        accountHolderName: null,
      }
      await persistValidation(employeeId, companyId, result)
      return {
        employeeId: row.id,
        name: row.name,
        phone: verification.phone ?? parsed.national,
        carrier: result.carrier,
        accountValid: false,
        mobileEligible: false,
        validatedAt: nowIso(),
        error: result.error,
        verificationScope: verification.verificationScope,
      }
    }

    const result = {
      carrier: verification.carrier,
      accountValid: true,
      error: verification.warning ?? null,
      accountHolderName: verification.accountHolderName ?? null,
    }
    await persistValidation(employeeId, companyId, result)

    await paymentLogService.info({
      companyId,
      event: "employee.account.validated",
      message: `Employee mobile account verified via Instanvi: ${row.name}`,
      metadata: {
        employeeId,
        phone: verification.phone,
        carrier: verification.carrier,
        provider: verification.provider,
        verificationScope: verification.verificationScope,
        accountHolderName: verification.accountHolderName,
      },
    })

    return {
      employeeId: row.id,
      name: row.name,
      phone: verification.phone,
      carrier: verification.carrier,
      accountValid: true,
      mobileEligible: verification.mobileEligible,
      validatedAt: nowIso(),
      error: verification.warning ?? null,
      accountHolderName: verification.accountHolderName,
      verificationScope: verification.verificationScope,
    }
  },

  async validateMany(
    companyId: string,
    employeeIds?: string[]
  ) {
    const rows = employeeIds?.length
      ? await db
          .select()
          .from(employees)
          .where(
            and(
              eq(employees.companyId, companyId),
              inArray(employees.id, employeeIds)
            )
          )
      : await db
          .select()
          .from(employees)
          .where(
            and(
              eq(employees.companyId, companyId),
              eq(employees.status, "active")
            )
          )

    const results: EmployeeAccountValidation[] = []
    for (const row of rows) {
      results.push(await this.validateEmployee(row.id, companyId))
    }

    const summary = {
      total: results.length,
      valid: results.filter((r) => r.accountValid === true).length,
      invalid: results.filter((r) => r.accountValid === false).length,
      mtn: results.filter((r) => r.carrier === "mtn").length,
      orange: results.filter((r) => r.carrier === "orange").length,
      mobileEligible: results.filter((r) => r.mobileEligible).length,
    }

    return { summary, results }
  },

  clearValidation(employeeId: string, companyId: string) {
    return db
      .update(employees)
      .set({
        mobileCarrier: null,
        mobileAccountValid: null,
        mobileAccountValidatedAt: null,
        mobileAccountValidationError: null,
        mobileAccountHolderName: null,
        updatedAt: nowIso(),
      })
      .where(and(eq(employees.id, employeeId), eq(employees.companyId, companyId)))
  },
}
