import { z } from "zod"

export const inviteMemberSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  role: z.enum(["admin", "manager", "viewer"]),
})

export const addMemberSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  role: z.enum(["admin", "manager", "viewer"]),
  password: z.string().min(8),
})

export const updateMemberRoleSchema = z.object({
  role: z.enum(["admin", "manager", "viewer"]),
})

export const memberIdParamSchema = z.object({
  id: z.string().min(1),
})

export type InviteMemberInput = z.infer<typeof inviteMemberSchema>
export type AddMemberInput = z.infer<typeof addMemberSchema>
