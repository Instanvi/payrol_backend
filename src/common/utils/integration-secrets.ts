import { decryptSecret } from "./secret-crypto"

/** AES-256-GCM payloads are stored as iv:tag:ciphertext (base64). */
function looksEncrypted(payload: string) {
  const parts = payload.split(":")
  return parts.length === 3 && parts.every((part) => part.length > 0)
}

/** Store Instanvi keys as plaintext — encryption caused prod decrypt mismatches. */
export function storeIntegrationSecret(plaintext: string) {
  return plaintext.trim()
}

/** Read a stored key. Legacy encrypted values are decrypted once for migration. */
export function readIntegrationSecret(stored: string) {
  const trimmed = stored.trim()
  if (!trimmed) return ""

  if (looksEncrypted(trimmed)) {
    try {
      return decryptSecret(trimmed).trim()
    } catch {
      return trimmed
    }
  }

  return trimmed
}
