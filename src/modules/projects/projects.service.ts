import { and, count, eq, inArray } from "drizzle-orm"
import ExcelJS from "exceljs"

import { AppError } from "../../common/errors/AppError"
import { createId, nowIso } from "../../common/utils/id"
import { env } from "../../config/env"
import { db } from "../../db"
import { findOne } from "../../db/query"
import {
  employees,
  payRuns,
  payrollTransactions,
  projectEmployees,
  projects,
} from "../../db/schema"

type ProjectStatus = "active" | "inactive"

function mapProject(
  row: typeof projects.$inferSelect,
  stats?: { employeeCount: number; payRunCount: number }
) {
  return {
    id: row.id,
    name: row.name,
    code: row.code ?? undefined,
    description: row.description ?? undefined,
    status: row.status as ProjectStatus,
    employeeCount: stats?.employeeCount ?? 0,
    payRunCount: stats?.payRunCount ?? 0,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

async function getProjectStats(projectId: string) {
  const [employeeRow] = await db
    .select({ value: count() })
    .from(projectEmployees)
    .where(eq(projectEmployees.projectId, projectId))

  const [payRunRow] = await db
    .select({ value: count() })
    .from(payRuns)
    .where(eq(payRuns.projectId, projectId))

  return {
    employeeCount: employeeRow?.value ?? 0,
    payRunCount: payRunRow?.value ?? 0,
  }
}

export const projectsService = {
  async list(companyId = env.DEFAULT_COMPANY_ID, status?: ProjectStatus) {
    const rows = status
      ? await db
          .select()
          .from(projects)
          .where(
            and(eq(projects.companyId, companyId), eq(projects.status, status))
          )
      : await db
          .select()
          .from(projects)
          .where(eq(projects.companyId, companyId))

    return Promise.all(
      rows.map(async (row) =>
        mapProject(row, await getProjectStats(row.id))
      )
    )
  },

  async getById(id: string, companyId = env.DEFAULT_COMPANY_ID) {
    const row = await findOne(
      db
        .select()
        .from(projects)
        .where(and(eq(projects.id, id), eq(projects.companyId, companyId)))
    )
    if (!row) throw AppError.notFound("Project not found")
    return mapProject(row, await getProjectStats(row.id))
  },

  async getActiveById(id: string, companyId: string) {
    const project = await this.getById(id, companyId)
    if (project.status !== "active") {
      throw AppError.validation("Project is not active")
    }
    return project
  },

  async create(
    input: { name: string; code?: string; description?: string },
    companyId = env.DEFAULT_COMPANY_ID
  ) {
    const id = createId()
    const now = nowIso()

    await db.insert(projects).values({
      id,
      companyId,
      name: input.name,
      code: input.code ?? null,
      description: input.description ?? null,
      status: "active",
      createdAt: now,
      updatedAt: now,
    })

    return this.getById(id, companyId)
  },

  async update(
    id: string,
    input: {
      name?: string
      code?: string
      description?: string
      status?: ProjectStatus
    },
    companyId = env.DEFAULT_COMPANY_ID
  ) {
    await this.getById(id, companyId)
    const now = nowIso()

    await db
      .update(projects)
      .set({
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.code !== undefined ? { code: input.code } : {}),
        ...(input.description !== undefined
          ? { description: input.description }
          : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        updatedAt: now,
      })
      .where(and(eq(projects.id, id), eq(projects.companyId, companyId)))

    return this.getById(id, companyId)
  },

  async remove(id: string, companyId = env.DEFAULT_COMPANY_ID) {
    await this.getById(id, companyId)

    const [pendingPayRun] = await db
      .select({ id: payRuns.id })
      .from(payRuns)
      .where(
        and(
          eq(payRuns.projectId, id),
          inArray(payRuns.status, ["draft", "pending"])
        )
      )
      .limit(1)

    if (pendingPayRun) {
      throw AppError.validation(
        "Cannot delete project with active or pending pay runs"
      )
    }

    await db
      .delete(projects)
      .where(and(eq(projects.id, id), eq(projects.companyId, companyId)))
  },

  async listEmployees(projectId: string, companyId = env.DEFAULT_COMPANY_ID) {
    await this.getById(projectId, companyId)

    const rows = await db
      .select({
        id: employees.id,
        name: employees.name,
        email: employees.email,
        phone: employees.phone,
        department: employees.department,
        status: employees.status,
        createdAt: employees.createdAt,
      })
      .from(projectEmployees)
      .innerJoin(employees, eq(projectEmployees.employeeId, employees.id))
      .where(
        and(
          eq(projectEmployees.projectId, projectId),
          eq(employees.companyId, companyId)
        )
      )

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      phone: row.phone ?? undefined,
      department: row.department ?? undefined,
      status: row.status as "active" | "inactive",
      createdAt: row.createdAt,
    }))
  },

  async setEmployees(
    projectId: string,
    employeeIds: string[],
    companyId = env.DEFAULT_COMPANY_ID
  ) {
    await this.getById(projectId, companyId)

    if (employeeIds.length > 0) {
      const validEmployees = await db
        .select({ id: employees.id })
        .from(employees)
        .where(
          and(
            eq(employees.companyId, companyId),
            inArray(employees.id, employeeIds)
          )
        )

      if (validEmployees.length !== employeeIds.length) {
        throw AppError.validation("One or more employees are invalid")
      }
    }

    await db
      .delete(projectEmployees)
      .where(eq(projectEmployees.projectId, projectId))

    for (const employeeId of employeeIds) {
      await db.insert(projectEmployees).values({ projectId, employeeId })
    }

    return this.listEmployees(projectId, companyId)
  },

  async validateEmployeesOnProject(
    projectId: string,
    employeeIds: string[],
    companyId: string
  ) {
    if (employeeIds.length === 0) return

    const assigned = await db
      .select({ employeeId: projectEmployees.employeeId })
      .from(projectEmployees)
      .where(
        and(
          eq(projectEmployees.projectId, projectId),
          inArray(projectEmployees.employeeId, employeeIds)
        )
      )

    if (assigned.length !== employeeIds.length) {
      throw AppError.validation(
        "All selected employees must be assigned to the project"
      )
    }
  },

  async exportPayrollExcel(
    projectId: string,
    companyId = env.DEFAULT_COMPANY_ID
  ) {
    const project = await this.getById(projectId, companyId)

    const payRunRows = await db
      .select()
      .from(payRuns)
      .where(
        and(eq(payRuns.projectId, projectId), eq(payRuns.companyId, companyId))
      )
      .orderBy(payRuns.createdAt)

    const txnRows = await db
      .select()
      .from(payrollTransactions)
      .where(
        and(
          eq(payrollTransactions.projectId, projectId),
          eq(payrollTransactions.companyId, companyId)
        )
      )
      .orderBy(payrollTransactions.createdAt)

    const workbook = new ExcelJS.Workbook()
    workbook.creator = "Instanvi Payroll"

    const summarySheet = workbook.addWorksheet("Pay runs summary")
    summarySheet.columns = [
      { header: "Reference", key: "reference", width: 20 },
      { header: "Pay period", key: "payPeriod", width: 24 },
      { header: "Status", key: "status", width: 14 },
      { header: "Total amount", key: "amount", width: 16 },
      { header: "Currency", key: "currency", width: 10 },
      { header: "Employee count", key: "employeeCount", width: 16 },
      { header: "Created at", key: "createdAt", width: 22 },
    ]
    summarySheet.getRow(1).font = { bold: true }

    for (const payRun of payRunRows) {
      const employeeCount = txnRows.filter(
        (t) => t.payRunId === payRun.id
      ).length
      summarySheet.addRow({
        reference: payRun.reference,
        payPeriod: payRun.payPeriod,
        status: payRun.status,
        amount: payRun.amount,
        currency: payRun.currency,
        employeeCount,
        createdAt: payRun.createdAt,
      })
    }

    const linesSheet = workbook.addWorksheet("Payroll lines")
    linesSheet.columns = [
      { header: "Pay run ref", key: "payRunReference", width: 20 },
      { header: "Pay period", key: "payPeriod", width: 24 },
      { header: "Employee name", key: "employeeName", width: 24 },
      { header: "Email", key: "employeeEmail", width: 28 },
      { header: "Phone", key: "employeePhone", width: 16 },
      { header: "Gross", key: "grossAmount", width: 12 },
      { header: "Deductions", key: "deductions", width: 12 },
      { header: "Net", key: "amount", width: 12 },
      { header: "Status", key: "status", width: 14 },
      { header: "Paid at", key: "paidAt", width: 22 },
    ]
    linesSheet.getRow(1).font = { bold: true }

    for (const txn of txnRows) {
      linesSheet.addRow({
        payRunReference: txn.payRunReference,
        payPeriod: txn.payPeriod,
        employeeName: txn.employeeName,
        employeeEmail: txn.employeeEmail,
        employeePhone: txn.employeePhone ?? "",
        grossAmount: txn.grossAmount,
        deductions: txn.deductions,
        amount: txn.amount,
        status: txn.status,
        paidAt: txn.paidAt ?? "",
      })
    }

    const buffer = await workbook.xlsx.writeBuffer()
    const slug = (project.code ?? project.name)
      .replace(/[^a-zA-Z0-9-_]+/g, "-")
      .slice(0, 40)
    const date = new Date().toISOString().slice(0, 10)

    return {
      buffer: Buffer.from(buffer),
      filename: `${slug}-payroll-${date}.xlsx`,
    }
  },
}
