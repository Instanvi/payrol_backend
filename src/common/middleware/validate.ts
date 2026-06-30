import type { NextFunction, Request, Response } from "express"
import type { ZodTypeAny } from "zod"

import { AppError } from "../errors/AppError"

type ValidationSchemas = {
  body?: ZodTypeAny
  query?: ZodTypeAny
  params?: ZodTypeAny
}

function assignRequestProperty<T>(
  req: Request,
  key: "body" | "query" | "params",
  value: T
) {
  Object.defineProperty(req, key, {
    value,
    writable: true,
    configurable: true,
    enumerable: true,
  })
}

export function validate(schemas: ValidationSchemas) {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (schemas.body) {
        assignRequestProperty(req, "body", schemas.body.parse(req.body))
      }
      if (schemas.query) {
        assignRequestProperty(
          req,
          "query",
          schemas.query.parse(req.query) as Request["query"]
        )
      }
      if (schemas.params) {
        assignRequestProperty(
          req,
          "params",
          schemas.params.parse(req.params) as Request["params"]
        )
      }
      next()
    } catch (error) {
      if (error instanceof AppError) {
        next(error)
        return
      }
      next(error)
    }
  }
}
