import { z } from "zod"

export const createUserSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8).optional(),
  role: z.enum(["admin", "manager", "viewer"]),
  avatar: z.string().url().optional(),
})

export const updateUserSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().optional(),
  password: z.string().min(8).optional(),
  role: z.enum(["owner", "admin", "manager", "viewer"]).optional(),
  status: z.enum(["active", "invited", "inactive"]).optional(),
  avatar: z.string().url().optional().nullable(),
})

export const userIdParamSchema = z.object({
  id: z.string().min(1),
})

export type CreateUserInput = z.infer<typeof createUserSchema>
export type UpdateUserInput = z.infer<typeof updateUserSchema>

export function toPublicUser(user: {
  id: string
  name: string
  email: string
  avatar?: string | null
  role: string
  status: string
  companyId?: string | null
  isSystemAdmin?: boolean | null
  createdAt: string
  updatedAt: string
}) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    avatar: user.avatar ?? undefined,
    role: user.role as "owner" | "admin" | "manager" | "viewer",
    status: user.status as "active" | "invited" | "inactive",
    companyId: user.companyId ?? null,
    isSystemAdmin: user.isSystemAdmin ?? false,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  }
}

export function toMemberShape(user: ReturnType<typeof toPublicUser>) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status === "inactive" ? "invited" : user.status,
  }
}
