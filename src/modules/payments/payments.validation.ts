import { z } from "zod"

export const createPaymentSchema = z.object({
  reference: z.string().min(3),
  payPeriod: z.string().min(3),
  description: z.string().optional(),
  amount: z.number().positive(),
  currency: z.enum(["USD", "EUR", "GBP", "XAF"]),
  scheduledAt: z.string().optional(),
  employeeIds: z.array(z.string().min(1)).min(1),
})

export const updatePaymentStatusSchema = z.object({
  status: z.enum(["draft", "pending", "completed", "failed"]),
})

export const paymentIdParamSchema = z.object({
  id: z.string().min(1),
})

export const bulkDisburseBodySchema = z
  .object({
    currency: z.string().length(3).optional(),
    employeeIds: z.array(z.string().uuid()).min(1).optional(),
    transactionIds: z.array(z.string().uuid()).min(1).optional(),
  })
  .refine(
    (data) => !(data.employeeIds?.length && data.transactionIds?.length),
    {
      message: "Provide either employeeIds or transactionIds, not both",
    }
  )

export type CreatePaymentInput = z.infer<typeof createPaymentSchema>
export type BulkDisburseInput = z.infer<typeof bulkDisburseBodySchema>
