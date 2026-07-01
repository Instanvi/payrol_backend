import { z } from "zod"

export const updateCompanyProfileSchema = z.object({
  name: z.string().min(2).optional(),
  legalName: z.string().min(2).optional(),
  industry: z.string().optional(),
  timezone: z.string().optional(),
  address: z.string().min(3).optional(),
  taxId: z.string().min(3).optional(),
  billingEmail: z.string().email().optional(),
})

export const uploadKycDocumentSchema = z.object({
  documentType: z.enum([
    "business_registration",
    "tax_certificate",
    "director_id",
    "bank_statement",
    "other",
  ]),
  fileName: z.string().min(1),
  mimeType: z.string().min(1),
  contentBase64: z.string().min(1),
})

export const rejectCompanySchema = z.object({
  reason: z.string().min(5),
})

export const approveCompanySchema = z.object({
  chargeId: z.string().uuid().optional(),
  forceApprove: z.boolean().optional(),
})

export const createChargeSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  isDefault: z.boolean().optional(),
  fixedFee: z.number().min(0),
  percentFee: z.number().min(0).max(100),
  minFee: z.number().min(0).optional(),
  maxFee: z.number().min(0).optional(),
  currency: z.string().length(3).optional(),
})

export const assignChargeSchema = z.object({
  chargeId: z.string().uuid(),
})
