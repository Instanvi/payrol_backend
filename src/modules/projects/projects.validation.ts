import { z } from "zod"

export const createProjectSchema = z.object({
  name: z.string().min(2),
  code: z.string().min(1).max(32).optional(),
  description: z.string().optional(),
})

export const updateProjectSchema = z.object({
  name: z.string().min(2).optional(),
  code: z.string().min(1).max(32).optional(),
  description: z.string().optional(),
  status: z.enum(["active", "inactive"]).optional(),
})

export const projectIdParamSchema = z.object({
  id: z.string().uuid(),
})

export const setProjectEmployeesSchema = z.object({
  employeeIds: z.array(z.string().uuid()),
})

export type CreateProjectInput = z.infer<typeof createProjectSchema>
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>
