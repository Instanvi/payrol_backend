const BRAND = "Instanvi Payroll"

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

export function baseEmailLayout(input: {
  preheader?: string
  title: string
  bodyHtml: string
  footerNote?: string
}) {
  const preheader = input.preheader ?? input.title
  const footer =
    input.footerNote ??
    "This is an automated message. Please do not reply to this email."

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(input.title)}</title>
  </head>
  <body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,Helvetica,sans-serif;color:#333333;">
    <span style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</span>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f5f5f5;padding:24px 16px;">
      <tr>
        <td align="left">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#ffffff;">
            <tr>
              <td style="padding:32px 40px 24px;text-align:left;">
                ${input.bodyHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:0 40px 32px;">
                <hr style="border:0;border-top:1px solid #e0e0e0;margin:0 0 16px;" />
                <p style="margin:0;font-size:11px;line-height:1.5;color:#666666;text-align:left;">
                  ${escapeHtml(footer)}
                </p>
                <p style="margin:8px 0 0;font-size:11px;line-height:1.5;color:#666666;text-align:left;">
                  &copy; ${new Date().getFullYear()} ${BRAND}. All rights reserved.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

export function otpEmailTemplate(input: {
  recipientName: string
  code: string
  expiresMinutes: number
}) {
  const name = escapeHtml(input.recipientName || "there")
  const code = escapeHtml(input.code)
  const minutes = input.expiresMinutes

  const bodyHtml = `
    <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#333333;">Hello ${name},</p>
    <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#333333;">
      Use the verification code below to finish signing in to your payroll dashboard.
    </p>
    <p style="margin:0 0 8px;font-size:14px;line-height:1.6;color:#333333;">Your verification code is:</p>
    <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#333333;font-weight:bold;letter-spacing:0.15em;">${code}</p>
    <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#333333;">
      This code expires in ${minutes} minutes. If you did not try to sign in, you can safely ignore this email.
    </p>
    <p style="margin:0 0 4px;font-size:14px;line-height:1.6;color:#333333;">Thanks,</p>
    <p style="margin:0;font-size:14px;line-height:1.6;color:#333333;">The ${BRAND} Team</p>`

  const html = baseEmailLayout({
    preheader: `Your sign-in code is ${input.code}`,
    title: "Your sign-in code",
    bodyHtml,
  })

  const text = `Hello ${input.recipientName || "there"},

Use the verification code below to finish signing in to your payroll dashboard.

Your verification code is: ${input.code}

This code expires in ${minutes} minutes. If you did not try to sign in, you can safely ignore this email.

Thanks,
The ${BRAND} Team`

  return {
    subject: `${input.code} is your Instanvi Payroll sign-in code`,
    html,
    text,
    preview: `Sign-in code ${input.code}`,
  }
}

export function infoEmailTemplate(input: {
  recipientName: string
  title: string
  message: string
  actionLabel?: string
  actionUrl?: string
}) {
  const name = escapeHtml(input.recipientName || "there")
  const message = escapeHtml(input.message).replace(/\n/g, "<br />")

  const action =
    input.actionLabel && input.actionUrl
      ? `<p style="margin:16px 0 0;font-size:14px;line-height:1.6;color:#333333;">
          <a href="${escapeHtml(input.actionUrl)}" style="color:#0066cc;text-decoration:underline;">
            ${escapeHtml(input.actionLabel)}
          </a>
        </p>`
      : ""

  const bodyHtml = `
    <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#333333;">Hello ${name},</p>
    <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#333333;">${message}</p>
    ${action}
    <p style="margin:24px 0 4px;font-size:14px;line-height:1.6;color:#333333;">Thanks,</p>
    <p style="margin:0;font-size:14px;line-height:1.6;color:#333333;">The ${BRAND} Team</p>`

  const html = baseEmailLayout({
    preheader: input.message.slice(0, 120),
    title: input.title,
    bodyHtml,
  })

  const text = `Hello ${input.recipientName || "there"},

${input.message}

${input.actionLabel && input.actionUrl ? `${input.actionLabel}: ${input.actionUrl}` : ""}

Thanks,
The ${BRAND} Team`.trim()

  return {
    subject: input.title,
    html,
    text,
    preview: input.message.slice(0, 120),
  }
}
