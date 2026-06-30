import type { Request } from "express"

import { AppError } from "../errors/AppError"
import { verifyAccessToken, type JwtPayload } from "./jwt"

export interface AuthContext extends JwtPayload {
  token: string
}

export type TenantAuthContext = AuthContext & { companyId: string }

declare global {
  namespace Express {
    interface Request {
      auth?: AuthContext
    }
  }
}

export function getAuth(req: Request) {
  if (!req.auth) {
    throw new Error("Auth context missing — use authenticate middleware")
  }
  return req.auth
}

export function requireTenantAuth(req: Request): TenantAuthContext {
  const auth = getAuth(req)
  if (!auth.companyId) {
    throw AppError.forbidden("This action requires a company account")
  }
  return auth as TenantAuthContext
}

export function extractBearerToken(req: Request) {
  const header = req.headers.authorization
  if (!header?.startsWith("Bearer ")) return null
  return header.slice(7).trim()
}

export function setAuthFromToken(req: Request, token: string) {
  const payload = verifyAccessToken(token)
  req.auth = { ...payload, token }
}
