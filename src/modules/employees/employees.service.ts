import { and, eq } from "drizzle-orm"

import { AppError } from "../../common/errors/AppError"
import { createId, nowIso } from "../../common/utils/id"
import { env } from "../../config/env"
import { db } from "../../db/index"
import { findOne } from "../../db/query"
import { employees } from "../../db/schema/index"
import { employeesAccountService } from "./employees-account.service"
import type {
  CreateEmployeeInput,
  ImportEmployeesInput,
  UpdateEmployeeInput,
} from "./employees.validation"

function mapEmployee(row: typeof employees.$inferSelect) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone ?? undefined,
    department: row.department ?? undefined,
    jobTitle: row.jobTitle ?? undefined,
    employmentType: row.employmentType as
      | "full_time"
      | "part_time"
      | "contractor",
    startDate: row.startDate ?? undefined,
    baseSalary: row.baseSalary ?? undefined,
    taxId: row.taxId ?? undefined,
    status: row.status as "active" | "inactive",
    mobileCarrier: row.mobileCarrier ?? undefined,
    mobileAccountValid: row.mobileAccountValid ?? undefined,
    mobileAccountValidatedAt: row.mobileAccountValidatedAt ?? undefined,
    mobileAccountValidationError: row.mobileAccountValidationError ?? undefined,
    accountChecked: row.mobileAccountValid !== null && row.mobileAccountValid !== undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export const employeesService = {
  async list(companyId = env.DEFAULT_COMPANY_ID) {
    const rows = await db
      .select()
      .from(employees)
      .where(eq(employees.companyId, companyId))

    return rows.map(mapEmployee)
  },

  async getById(id: string, companyId = env.DEFAULT_COMPANY_ID) {
    const row = await findOne(
      db
        .select()
        .from(employees)
        .where(and(eq(employees.id, id), eq(employees.companyId, companyId)))
    )

    if (!row) throw AppError.notFound("Employee not found")
    return mapEmployee(row)
  },

  async create(input: CreateEmployeeInput, companyId = env.DEFAULT_COMPANY_ID) {
    const existing = await findOne(
      db
        .select()
        .from(employees)
        .where(
          and(
            eq(employees.companyId, companyId),
            eq(employees.email, input.email.toLowerCase())
          )
        )
    )

    if (existing) {
      throw AppError.duplicate("An employee with this email already exists")
    }

    const now = nowIso()
    const row = {
      id: createId(),
      companyId,
      name: input.name,
      email: input.email.toLowerCase(),
      phone: input.phone ?? null,
      department: input.department ?? null,
      jobTitle: input.jobTitle ?? null,
      employmentType: input.employmentType ?? "full_time",
      startDate: input.startDate ?? null,
      baseSalary: input.baseSalary ?? null,
      taxId: input.taxId ?? null,
      status: input.status ?? "active",
      mobileCarrier: null,
      mobileAccountValid: null,
      mobileAccountValidatedAt: null,
      mobileAccountValidationError: null,
      createdAt: now,
      updatedAt: now,
    }

    await db.insert(employees).values(row)
    return mapEmployee(row)
  },

  async update(
    id: string,
    input: UpdateEmployeeInput,
    companyId = env.DEFAULT_COMPANY_ID
  ) {
    const current = await findOne(
      db
        .select()
        .from(employees)
        .where(and(eq(employees.id, id), eq(employees.companyId, companyId)))
    )

    if (!current) throw AppError.notFound("Employee not found")

    if (input.email) {
      const duplicates = await db
        .select()
        .from(employees)
        .where(
          and(
            eq(employees.companyId, companyId),
            eq(employees.email, input.email.toLowerCase())
          )
        )

      if (duplicates.some((row) => row.id !== id)) {
        throw AppError.duplicate("An employee with this email already exists")
      }
    }

    const phoneChanged =
      input.phone !== undefined && input.phone !== current.phone

    await db
      .update(employees)
      .set({
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.email !== undefined
          ? { email: input.email.toLowerCase() }
          : {}),
        ...(input.phone !== undefined ? { phone: input.phone ?? null } : {}),
        ...(phoneChanged
          ? {
              mobileCarrier: null,
              mobileAccountValid: null,
              mobileAccountValidatedAt: null,
              mobileAccountValidationError: null,
            }
          : {}),
        ...(input.department !== undefined
          ? { department: input.department ?? null }
          : {}),
        ...(input.jobTitle !== undefined
          ? { jobTitle: input.jobTitle ?? null }
          : {}),
        ...(input.employmentType !== undefined
          ? { employmentType: input.employmentType }
          : {}),
        ...(input.startDate !== undefined
          ? { startDate: input.startDate ?? null }
          : {}),
        ...(input.baseSalary !== undefined
          ? { baseSalary: input.baseSalary ?? null }
          : {}),
        ...(input.taxId !== undefined ? { taxId: input.taxId ?? null } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        updatedAt: nowIso(),
      })
      .where(and(eq(employees.id, id), eq(employees.companyId, companyId)))

    return this.getById(id, companyId)
  },

  async deactivate(id: string, companyId = env.DEFAULT_COMPANY_ID) {
    await this.getById(id, companyId)
    await db
      .update(employees)
      .set({ status: "inactive", updatedAt: nowIso() })
      .where(and(eq(employees.id, id), eq(employees.companyId, companyId)))
  },

  async importRows(
    input: ImportEmployeesInput,
    companyId = env.DEFAULT_COMPANY_ID
  ) {
    let imported = 0
    let skipped = 0

    for (const row of input.rows) {
      const existing = await findOne(
        db
          .select()
          .from(employees)
          .where(
            and(
              eq(employees.companyId, companyId),
              eq(employees.email, row.email.toLowerCase())
            )
          )
      )

      if (existing) {
        skipped++
        continue
      }

      const now = nowIso()
      await db.insert(employees).values({
        id: createId(),
        companyId,
        name: row.name,
        email: row.email.toLowerCase(),
        phone: row.phone ?? null,
        department: row.department ?? null,
        jobTitle: row.jobTitle ?? null,
        employmentType: row.employmentType ?? "full_time",
        startDate: row.startDate ?? null,
        baseSalary: row.baseSalary ?? null,
        taxId: row.taxId ?? null,
        status: "active",
        mobileCarrier: null,
        mobileAccountValid: null,
        mobileAccountValidatedAt: null,
        mobileAccountValidationError: null,
        createdAt: now,
        updatedAt: now,
      })
      imported++
    }

    return { imported, skipped }
  },

  async getActiveByIds(ids: string[], companyId = env.DEFAULT_COMPANY_ID) {
    const all = await this.list(companyId)
    return ids
      .map((id) => all.find((employee) => employee.id === id))
      .filter(
        (employee): employee is NonNullable<typeof employee> =>
          !!employee && employee.status === "active"
      )
  },

  async validateAccount(id: string, companyId = env.DEFAULT_COMPANY_ID) {
    await employeesAccountService.validateEmployee(id, companyId)
    return this.getById(id, companyId)
  },

  async validateAccounts(
    companyId = env.DEFAULT_COMPANY_ID,
    employeeIds?: string[]
  ) {
    return employeesAccountService.validateMany(companyId, employeeIds)
  },
}
