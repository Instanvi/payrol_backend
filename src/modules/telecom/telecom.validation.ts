import { z } from "zod"

export const validatePhoneQuerySchema = z.object({
  phone: z.string().min(8),
})

export const validatePhonesBodySchema = z.object({
  phones: z.array(z.string().min(8)).min(1).max(500),
})
