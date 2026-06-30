export type PaymentStatus = "draft" | "pending" | "completed" | "failed"
export type TransactionStatus = "pending" | "processing" | "completed" | "failed"

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

export function computeDeductions(gross: number, rate = 0.22): number {
  return Math.round(gross * rate * 100) / 100
}

export function computeNetPay(gross: number, deductions?: number): number {
  const d = deductions ?? computeDeductions(gross)
  return Math.round((gross - d) * 100) / 100
}

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
