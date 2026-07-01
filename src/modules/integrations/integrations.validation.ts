import { z } from "zod"

export const saveInstanviKeysSchema = z.object({
  apiKey: z.string().trim().min(8, "API key must be at least 8 characters"),
  locationId: z.string().trim().optional(),
})

export type SaveInstanviKeysInput = z.infer<typeof saveInstanviKeysSchema>
