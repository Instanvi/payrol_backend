import {
  detectCarrier,
  normalizeCameroonMobile,
  type ParsedPhone,
} from "../../common/utils/phone-carrier"

export const telecomService = {
  validatePhone(phone: string): ParsedPhone {
    return detectCarrier(phone)
  },

  validatePhones(phones: string[]) {
    const results = phones.map((phone) => ({
      input: phone,
      ...detectCarrier(phone),
    }))

    const summary = {
      total: results.length,
      valid: results.filter((r) => r.valid).length,
      mtn: results.filter((r) => r.carrier === "mtn").length,
      orange: results.filter((r) => r.carrier === "orange").length,
      other: results.filter(
        (r) => r.valid && r.carrier !== "mtn" && r.carrier !== "orange"
      ).length,
      invalid: results.filter((r) => !r.valid).length,
      mobileEligible: results.filter(
        (r) => r.valid && (r.carrier === "mtn" || r.carrier === "orange")
      ).length,
    }

    return { summary, results }
  },

  normalizeForMomo(phone: string) {
    const national = normalizeCameroonMobile(phone)
    if (!national) return null
    return national
  },
}
