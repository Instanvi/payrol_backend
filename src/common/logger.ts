import pino from "pino"

import { env } from "../config/env"

const isDev = env.NODE_ENV === "development"

export const logger = pino({
  level: env.LOG_LEVEL,
  timestamp: pino.stdTimeFunctions.isoTime,
  ...(isDev
    ? {
        transport: {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "yyyy-mm-dd HH:MM:ss.l Z",
            ignore: "pid,hostname",
          },
        },
      }
    : {}),
})
