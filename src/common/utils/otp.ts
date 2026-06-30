import { randomInt } from "node:crypto"

import bcrypt from "bcryptjs"

const SALT_ROUNDS = 10

export function generateOtpCode() {
  return String(randomInt(100_000, 1_000_000))
}

export async function hashOtpCode(code: string) {
  return bcrypt.hash(code, SALT_ROUNDS)
}

export async function verifyOtpCode(code: string, hash: string) {
  return bcrypt.compare(code, hash)
}
