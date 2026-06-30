export type MobileCarrier = "mtn" | "orange" | "nexttel" | "camtel" | "unknown"

export interface ParsedPhone {
  valid: boolean
  carrier: MobileCarrier
  prefix: string
  national: string
  e164: string
  display: string
  error?: string
}

/** MTN Cameroon mobile prefixes (original allocation; MNP may apply). */
const MTN_PREFIXES = new Set([
  "650",
  "651",
  "652",
  "653",
  "654",
  "670",
  "671",
  "672",
  "673",
  "674",
  "675",
  "676",
  "677",
  "678",
  "679",
  "680",
  "681",
  "682",
  "683",
])

/** Orange Cameroon mobile prefixes. */
const ORANGE_PREFIXES = new Set([
  "640",
  "655",
  "656",
  "657",
  "658",
  "659",
  "686",
  "687",
  "688",
  "689",
  "690",
  "691",
  "692",
  "693",
  "694",
  "695",
  "696",
  "697",
  "698",
  "699",
])

const NEXTTEL_PREFIXES = new Set(["660", "661", "662", "663", "664", "665", "684", "685"])

const CAMTEL_PREFIXES = new Set(["620", "621", "622", "623", "624", "625", "626", "627", "628", "629"])

const DEFAULT_COUNTRY_CODE = "237"

function digitsOnly(value: string) {
  return value.replace(/\D/g, "")
}

/**
 * Normalizes Cameroon mobiles to 9-digit national format (e.g. 677123456).
 * Accepts +237, 237, 0-prefixed, or local 9-digit input.
 */
export function normalizeCameroonMobile(phone: string): string | null {
  let digits = digitsOnly(phone)

  if (digits.startsWith(DEFAULT_COUNTRY_CODE) && digits.length >= 11) {
    digits = digits.slice(DEFAULT_COUNTRY_CODE.length)
  }

  if (digits.startsWith("0") && digits.length === 10) {
    digits = digits.slice(1)
  }

  if (digits.length !== 9 || !digits.startsWith("6")) {
    return null
  }

  return digits
}

export function detectCarrier(phone: string): ParsedPhone {
  const national = normalizeCameroonMobile(phone)

  if (!national) {
    return {
      valid: false,
      carrier: "unknown",
      prefix: "",
      national: "",
      e164: "",
      display: "",
      error: "Invalid Cameroon mobile number. Expected 9 digits starting with 6.",
    }
  }

  const prefix3 = national.slice(0, 3)
  const prefix2 = national.slice(0, 2)

  let carrier: MobileCarrier = "unknown"

  if (MTN_PREFIXES.has(prefix3) || prefix2 === "67") {
    carrier = "mtn"
  } else if (ORANGE_PREFIXES.has(prefix3) || prefix2 === "69" || prefix2 === "64") {
    carrier = "orange"
  } else if (NEXTTEL_PREFIXES.has(prefix3) || prefix2 === "66") {
    carrier = "nexttel"
  } else if (CAMTEL_PREFIXES.has(prefix3) || prefix2 === "62") {
    carrier = "camtel"
  }

  const display = `${national.slice(0, 3)} ${national.slice(3, 5)} ${national.slice(5, 7)} ${national.slice(7)}`

  return {
    valid: true,
    carrier,
    prefix: prefix3,
    national,
    e164: `+${DEFAULT_COUNTRY_CODE}${national}`,
    display,
  }
}

export function isMtnNumber(phone: string) {
  return detectCarrier(phone).carrier === "mtn"
}

export function isOrangeNumber(phone: string) {
  return detectCarrier(phone).carrier === "orange"
}

export function isMomoEligible(phone: string) {
  const parsed = detectCarrier(phone)
  return parsed.valid && parsed.carrier === "mtn"
}

export function validateCarrierForMomo(phone: string) {
  return validateCarrierForMobileMoney(phone)
}

export function validateCarrierForMobileMoney(phone: string) {
  const parsed = detectCarrier(phone)

  if (!parsed.valid) {
    return { ok: false as const, parsed, message: parsed.error ?? "Invalid phone number" }
  }

  if (parsed.carrier !== "mtn" && parsed.carrier !== "orange") {
    return {
      ok: false as const,
      parsed,
      message: `Carrier ${parsed.carrier} is not supported for mobile money payments.`,
    }
  }

  return { ok: true as const, parsed }
}
