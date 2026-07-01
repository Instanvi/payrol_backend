import crypto from "node:crypto"

import { AppError } from "../errors/AppError"
import { env } from "../../config/env"

const ALGORITHM = "aes-256-gcm"
const IV_LENGTH = 12

function deriveEncryptionKey(secret: string): Buffer {
  const raw = secret.trim()
  if (!raw) {
    throw AppError.validation("Encryption secret is not configured")
  }

  if (raw.length === 64 && /^[0-9a-f]+$/i.test(raw)) {
    return Buffer.from(raw, "hex")
  }

  if (Buffer.byteLength(raw, "utf8") === 32) {
    return Buffer.from(raw, "utf8")
  }

  if (/^[A-Za-z0-9+/]+={0,2}$/.test(raw)) {
    const decoded = Buffer.from(raw, "base64")
    if (decoded.length === 32) {
      return decoded
    }
  }

  return crypto.createHash("sha256").update(raw, "utf8").digest()
}

function resolveJwtEncryptionKey(): Buffer {
  return deriveEncryptionKey(env.JWT_SECRET)
}

function resolveLegacyEncryptionKey(): Buffer | null {
  const legacy = env.INTEGRATION_ENCRYPTION_KEY?.trim()
  if (!legacy || legacy === env.JWT_SECRET.trim()) {
    return null
  }
  return deriveEncryptionKey(legacy)
}

function decryptWithKey(payload: string, key: Buffer): string {
  const parts = payload.split(":")
  if (parts.length !== 3) {
    throw AppError.validation("Stored integration secret is invalid")
  }

  const [ivB64, tagB64, dataB64] = parts
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(ivB64!, "base64")
  )
  decipher.setAuthTag(Buffer.from(tagB64!, "base64"))

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataB64!, "base64")),
    decipher.final(),
  ])

  return decrypted.toString("utf8")
}

export function encryptSecret(plaintext: string): string {
  const key = resolveJwtEncryptionKey()
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ])
  const tag = cipher.getAuthTag()

  return [
    iv.toString("base64"),
    tag.toString("base64"),
    encrypted.toString("base64"),
  ].join(":")
}

export function decryptSecret(payload: string): string {
  try {
    return decryptWithKey(payload, resolveJwtEncryptionKey())
  } catch (primaryError) {
    const legacyKey = resolveLegacyEncryptionKey()
    if (legacyKey) {
      try {
        return decryptWithKey(payload, legacyKey)
      } catch {
        // Fall through to the primary error message below.
      }
    }

    if (primaryError instanceof AppError) throw primaryError
    throw AppError.validation(
      "Unable to decrypt stored integration secret. JWT_SECRET may have changed since keys were saved — reconnect Instanvi in Settings."
    )
  }
}
