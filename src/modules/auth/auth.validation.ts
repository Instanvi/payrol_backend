import { z } from "zod"

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

export const verify2FASchema = z.object({
  challengeToken: z.string().min(1),
  code: z
    .string()
    .length(6)
    .regex(/^\d+$/, "Code must be 6 digits"),
})

export const resend2FASchema = z.object({
  challengeToken: z.string().min(1),
})

export const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  companyName: z.string().min(2),
})

export const inviteTokenParamSchema = z.object({
  token: z.string().min(1),
})

export const acceptInviteSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8),
  name: z.string().min(2).optional(),
})

export type LoginInput = z.infer<typeof loginSchema>
export type Verify2FAInput = z.infer<typeof verify2FASchema>
export type RegisterInput = z.infer<typeof registerSchema>
export type AcceptInviteInput = z.infer<typeof acceptInviteSchema>
