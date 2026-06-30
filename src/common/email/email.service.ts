import { Resend } from "resend"

import { AppError } from "../errors/AppError"
import { env } from "../../config/env"

export interface SendEmailInput {
  to: string
  subject: string
  html: string
  text: string
}

export interface SendEmailResult {
  provider: "resend" | "console"
  messageId?: string
}

let resendClient: Resend | null = null

function getResend() {
  if (!env.RESEND_API_KEY) return null
  if (!resendClient) {
    resendClient = new Resend(env.RESEND_API_KEY)
  }
  return resendClient
}

export const emailService = {
  isConfigured() {
    return Boolean(env.RESEND_API_KEY && env.RESEND_FROM_EMAIL)
  },

  async send(input: SendEmailInput): Promise<SendEmailResult> {
    const resend = getResend()

    if (!resend || !env.RESEND_FROM_EMAIL) {
      if (env.NODE_ENV === "production") {
        throw new AppError(
          "Email provider is not configured",
          500,
          "EMAIL_NOT_CONFIGURED"
        )
      }

      console.info(
        `[email:console] To: ${input.to}\nSubject: ${input.subject}\n${input.text}`
      )

      return { provider: "console" }
    }

    const { data, error } = await resend.emails.send({
      from: env.RESEND_FROM_EMAIL,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
    })

    if (error) {
      throw new AppError(
        error.message || "Failed to send email",
        502,
        "EMAIL_SEND_FAILED"
      )
    }

    return {
      provider: "resend",
      messageId: data?.id,
    }
  },
}
