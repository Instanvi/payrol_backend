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
    "You received this email because of activity on your Instanvi Payroll account."

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(input.title)}</title>
  </head>
  <body style="margin:0;padding:0;background:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#18181b;">
    <span style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</span>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#ffffff;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;background:#ffffff;border:1px solid #e4e4e7;">
            <tr>
              <td style="padding:24px 28px;background:#ffffff;border-bottom:1px solid #e4e4e7;">
                <div style="font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#237804;font-weight:600;">${BRAND}</div>
                <div style="font-size:18px;font-weight:600;margin-top:6px;color:#237804;">${escapeHtml(input.title)}</div>
              </td>
            </tr>
            <tr>
              <td style="padding:28px;">
                ${input.bodyHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:0 28px 24px;font-size:12px;line-height:1.6;color:#71717a;">
                ${escapeHtml(footer)}
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
    <p style="margin:0 0 12px;font-size:14px;line-height:1.6;">Hi ${name},</p>
    <p style="margin:0 0 16px;font-size:14px;line-height:1.6;">
      Use this one-time code to finish signing in to your payroll dashboard.
    </p>
    <div style="margin:0 0 16px;padding:14px 16px;background:#ffffff;border:1px solid #e4e4e7;text-align:left;">
      <div style="font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#71717a;margin-bottom:6px;">Verification code</div>
      <div style="font-size:20px;font-weight:700;letter-spacing:0.2em;color:#18181b;">${code}</div>
    </div>
    <p style="margin:0;font-size:13px;line-height:1.6;color:#52525b;">
      This code expires in <strong>${minutes} minutes</strong>. If you did not try to sign in, you can safely ignore this email.
    </p>`

  const html = baseEmailLayout({
    preheader: `Your sign-in code is ${input.code}`,
    title: "Your sign-in code",
    bodyHtml,
  })

  const text = `Hi ${input.recipientName || "there"},

Your Instanvi Payroll sign-in code is: ${input.code}

This code expires in ${minutes} minutes.

If you did not try to sign in, you can ignore this email.`

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
  const title = escapeHtml(input.title)
  const message = escapeHtml(input.message).replace(/\n/g, "<br />")

  const action =
    input.actionLabel && input.actionUrl
      ? `<p style="margin:20px 0 0;">
          <a href="${escapeHtml(input.actionUrl)}" style="display:inline-block;padding:10px 16px;background:#237804;color:#ffffff;text-decoration:none;font-size:13px;font-weight:600;">
            ${escapeHtml(input.actionLabel)}
          </a>
        </p>`
      : ""

  const bodyHtml = `
    <p style="margin:0 0 12px;font-size:14px;line-height:1.6;">Hi ${name},</p>
    <p style="margin:0;font-size:14px;line-height:1.7;color:#3f3f46;">${message}</p>
    ${action}`

  const html = baseEmailLayout({
    preheader: input.message.slice(0, 120),
    title: input.title,
    bodyHtml,
  })

  const text = `Hi ${input.recipientName || "there"},

${input.title}

${input.message}

${input.actionLabel && input.actionUrl ? `${input.actionLabel}: ${input.actionUrl}` : ""}`.trim()

  return {
    subject: input.title,
    html,
    text,
    preview: input.message.slice(0, 120),
  }
}
