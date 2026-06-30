import jwt, { type SignOptions } from "jsonwebtoken"

import { env } from "../../config/env"
import { AppError } from "../errors/AppError"

export interface JwtPayload {
  userId: string
  companyId: string | null
  email: string
  role: string
  isSystemAdmin: boolean
}

export function signAccessToken(payload: JwtPayload) {
  const options: SignOptions = { expiresIn: env.JWT_EXPIRES_IN as SignOptions["expiresIn"] }
  return jwt.sign(payload, env.JWT_SECRET, options)
}

export function verifyAccessToken(token: string): JwtPayload {
  try {
    return jwt.verify(token, env.JWT_SECRET) as JwtPayload
  } catch {
    throw AppError.unauthorized("Invalid or expired token")
  }
}
