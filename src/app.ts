import cors from "cors"
import express from "express"
import helmet from "helmet"
import morgan from "morgan"

import { env } from "./config/env"
import { errorHandler } from "./common/middleware/errorHandler"
import { notFoundHandler } from "./common/middleware/notFoundHandler"
import { apiRouter } from "./routes/index"

export function createApp() {
  const app = express()

  app.use(helmet())
  app.use(
    cors({
      origin: env.CORS_ORIGIN,
      credentials: true,
    })
  )
  app.use(express.json({ limit: "6mb" }))
  app.use(morgan(env.NODE_ENV === "production" ? "combined" : "dev"))

  app.get("/health", (_req, res) => {
    res.json({ success: true, data: { status: "ok" } })
  })

  app.use("/api", apiRouter)

  app.use(notFoundHandler)
  app.use(errorHandler)

  return app
}
