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
}

async function persistValidation(
  employeeId: string,
  companyId: string,
  result: {
    carrier: MobileCarrier | null
    accountValid: boolean
    error: string | null
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

    const result = {
      carrier: parsed.carrier,
      accountValid: true,
      error: null,
    }
    await persistValidation(employeeId, companyId, result)

    await paymentLogService.info({
      companyId,
      event: "employee.account.validated",
      message: `Employee mobile account validated by carrier: ${row.name}`,
      metadata: {
        employeeId,
        phone: parsed.national,
        carrier: parsed.carrier,
      },
    })

    return {
      employeeId: row.id,
      name: row.name,
      phone: parsed.national,
      carrier: parsed.carrier,
      accountValid: true,
      mobileEligible: true,
      validatedAt: nowIso(),
      error: null,
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
        updatedAt: nowIso(),
      })
      .where(and(eq(employees.id, employeeId), eq(employees.companyId, companyId)))
  },
}
