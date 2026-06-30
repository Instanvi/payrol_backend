import type { NextFunction, Request, Response } from "express"

import { AppError } from "../errors/AppError"
import { extractBearerToken, setAuthFromToken } from "../utils/auth-context"

export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const token = extractBearerToken(req)
  if (!token) {
    next(AppError.unauthorized("Authentication required"))
    return
  }

  try {
    setAuthFromToken(req, token)
    next()
  } catch (error) {
    next(error)
  }
}

export function optionalAuthenticate(
  req: Request,
  _res: Response,
  next: NextFunction
) {
  const token = extractBearerToken(req)
  if (token) {
    try {
      setAuthFromToken(req, token)
    } catch {
      // ignore invalid token for optional auth
    }
  }
  next()
}

export function requireRoles(...roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth) {
      next(AppError.unauthorized("Authentication required"))
      return
    }
    if (!roles.includes(req.auth.role)) {
      next(AppError.forbidden("Insufficient permissions"))
      return
    }
    next()
  }
}
