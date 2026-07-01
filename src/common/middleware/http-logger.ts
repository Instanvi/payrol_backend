import type { Request } from "express"
import morgan from "morgan"

import { env } from "../../config/env"
import { logger } from "../logger"

function truncateJson(value: unknown, max = 2000) {
  if (value === undefined || value === null) return "-"
  const raw = typeof value === "string" ? value : JSON.stringify(value)
  if (!raw || raw === "{}") return "-"
  return raw.length > max ? `${raw.slice(0, max)}…` : raw
}

morgan.token("req-body", (req: Request) => truncateJson(req.body))

const devFormat =
  ":method :url :status :res[content-length] - :response-time ms req=:req-body"

const productionFormat =
  ":remote-addr :method :url :status :res[content-length] - :response-time ms"

export const httpLogger = morgan(
  env.NODE_ENV === "production" ? productionFormat : devFormat,
  {
    stream: {
      write: (line) => {
        logger.info({ type: "http.incoming" }, line.trim())
      },
    },
  }
)
