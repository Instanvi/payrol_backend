import { z } from "zod"

export const createEmployeeSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().min(1),
  department: z.string().optional(),
  jobTitle: z.string().optional(),
  employmentType: z
    .enum(["full_time", "part_time", "contractor"])
    .default("full_time"),
  startDate: z.string().optional(),
  baseSalary: z.number().positive().optional(),
  taxId: z.string().optional(),
  status: z.enum(["active", "inactive"]).default("active"),
})

export const updateEmployeeSchema = createEmployeeSchema.partial()

export const importEmployeesSchema = z.object({
  rows: z
    .array(
      z.object({
        name: z.string().min(1),
        email: z.string().email(),
        phone: z.string().min(1),
        department: z.string().optional(),
        jobTitle: z.string().optional(),
        employmentType: z.enum(["full_time", "part_time", "contractor"]).optional(),
        startDate: z.string().optional(),
        baseSalary: z.number().positive().optional(),
        taxId: z.string().optional(),
      })
    )
    .min(1),
})

export const employeeIdParamSchema = z.object({
  id: z.string().min(1),
})

export const validateAccountsBodySchema = z.object({
  employeeIds: z.array(z.string().min(1)).optional(),
})

export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>
export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>
export type ImportEmployeesInput = z.infer<typeof importEmployeesSchema>
