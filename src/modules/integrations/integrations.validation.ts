import { z } from "zod"

import { isValidInstanviApiKey } from "./instanvi-integration.utils"

export const saveInstanviKeysSchema = z.object({
  apiKey: z
    .string()
    .trim()
    .min(12, "API key is too short")
    .refine(isValidInstanviApiKey, {
      message:
        "API key must start with app_ (e.g. app_c05a083dc1850605a3b587e0ea0ac47ef0eda26bc7182198)",
    }),
  locationId: z.string().trim().min(1).optional(),
})

export type SaveInstanviKeysInput = z.infer<typeof saveInstanviKeysSchema>
