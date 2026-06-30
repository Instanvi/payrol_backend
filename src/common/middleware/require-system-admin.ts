import type { NextFunction, Request, Response } from "express"
import { eq } from "drizzle-orm"

import { AppError } from "../errors/AppError"
import { db } from "../../db"
import { findOne } from "../../db/query"
import { users } from "../../db/schema"

export function requireSystemAdmin(
  req: Request,
  _res: Response,
  next: NextFunction
) {
  if (!req.auth) {
    next(AppError.unauthorized("Authentication required"))
    return
  }

  void findOne(
    db.select().from(users).where(eq(users.id, req.auth.userId))
  )
    .then((user) => {
      if (!user?.isSystemAdmin) {
        next(AppError.forbidden("System admin access required"))
        return
      }
      next()
    })
    .catch(next)
}
