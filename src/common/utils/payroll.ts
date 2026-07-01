export type PaymentStatus = "draft" | "pending" | "completed" | "failed"
export type TransactionStatus = "pending" | "processing" | "completed" | "failed"

export interface PayrollLineAmounts {
  grossAmount: number
  deductions: number
  netPay: number
}

export function mapPayRunStatusToTransactionStatus(
  status: PaymentStatus
): TransactionStatus {
  switch (status) {
    case "draft":
      return "pending"
    case "pending":
      return "processing"
    case "completed":
      return "completed"
    case "failed":
      return "failed"
  }
}

export function splitPayrollAmount(total: number, count: number): number[] {
  if (count <= 0) return []
  const base = Math.floor((total / count) * 100) / 100
  const amounts = Array.from({ length: count }, () => base)
  const distributed = base * count
  amounts[count - 1] = Math.round((total - distributed + base) * 100) / 100
  return amounts
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100
}

/** Compute gross and tax deductions from a target net pay amount. */
export function computePayrollFromNetPay(
  netPay: number,
  taxRatePercent = 0
): PayrollLineAmounts {
  if (taxRatePercent <= 0) {
    return {
      grossAmount: roundMoney(netPay),
      deductions: 0,
      netPay: roundMoney(netPay),
    }
  }

  const rate = taxRatePercent / 100
  if (rate >= 1) {
    return {
      grossAmount: roundMoney(netPay),
      deductions: 0,
      netPay: roundMoney(netPay),
    }
  }

  const gross = roundMoney(netPay / (1 - rate))
  const deductions = roundMoney(gross - netPay)

  return {
    grossAmount: gross,
    deductions,
    netPay: roundMoney(netPay),
  }
}

/** @deprecated Use computePayrollFromNetPay — kept for exports/tests compatibility */
export function computeDeductions(gross: number, rate = 0): number {
  if (rate <= 0) return 0
  return roundMoney(gross * rate)
}

/** @deprecated Use computePayrollFromNetPay */
export function computeNetPay(gross: number, deductions?: number): number {
  const d = deductions ?? 0
  return roundMoney(gross - d)
}

export function payrollLinesFromEmployees(
  employees: { baseSalary?: number | null }[],
  totalNetAmount: number,
  taxRatePercent = 0
): PayrollLineAmounts[] {
  const salaries = employees.map((e) => e.baseSalary ?? 0)
  const hasSalaries = salaries.some((s) => s > 0)

  const netPerEmployee = hasSalaries
    ? salaries.map((s) => (s > 0 ? s : 0))
    : splitPayrollAmount(totalNetAmount, employees.length)

  return netPerEmployee.map((net) =>
    computePayrollFromNetPay(net, taxRatePercent)
  )
}

/** @deprecated Use payrollLinesFromEmployees */
export function amountsFromSalaries(
  employees: { baseSalary?: number | null }[],
  fallbackTotal?: number
): number[] {
  const salaries = employees.map((e) => e.baseSalary ?? 0)
  const hasSalaries = salaries.some((s) => s > 0)

  if (hasSalaries) {
    return salaries.map((s) => (s > 0 ? s : 0))
  }

  if (fallbackTotal !== undefined) {
    return splitPayrollAmount(fallbackTotal, employees.length)
  }

  return employees.map(() => 0)
}
