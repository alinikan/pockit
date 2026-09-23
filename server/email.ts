import { requiredEnv } from './http'

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }
    return entities[character]
  })
}

function layout(eyebrow: string, title: string, body: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
  <body style="margin:0;background:#081913;color:#f2f7ed;font-family:Arial,Helvetica,sans-serif">
    <div style="display:none;max-height:0;overflow:hidden">${escapeHtml(title)}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:38px 16px;background:#081913"><tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:540px;border:1px solid #2a4235;border-radius:24px;background:#10271e">
        <tr><td style="padding:34px 34px 10px"><div style="font-size:27px;font-weight:800;letter-spacing:-1.5px;color:#d9ff83">pockit<span style="color:#f2f7ed">.</span></div></td></tr>
        <tr><td style="padding:20px 34px 36px"><div style="color:#a8df9b;font-size:11px;font-weight:700;letter-spacing:2px">${escapeHtml(eyebrow)}</div>
          <h1 style="font-size:32px;line-height:1.15;letter-spacing:-1px;margin:16px 0 20px;color:#f2f7ed">${escapeHtml(title)}</h1>
          ${body}
          <div style="border-top:1px solid #2a4235;margin-top:32px;padding-top:23px;color:#9eb6a8;font-size:13px;line-height:1.6">A little more clarity, every day.<br><strong style="color:#d9ff83">The Pockit team</strong></div>
        </td></tr>
      </table><p style="color:#769184;font-size:12px;line-height:1.5;margin:22px 0">This is a service email from Pockit.</p>
    </td></tr></table>
  </body></html>`
}

const paragraph = (content: string) =>
  `<p style="font-size:16px;line-height:1.7;color:#d2e0d6;margin:0 0 17px">${content}</p>`

export function deletionEmail() {
  return {
    subject: 'Your Pockit account has been deleted',
    htmlContent: layout(
      'A NOTE FROM POCKIT',
      'Your space has been cleared.',
      paragraph('Your Pockit account and the budget data linked to it have been deleted.') +
        paragraph(
          'Thanks for letting Pockit be part of your money journey. If you ever want a fresh start, you can make a new account.',
        ) +
        paragraph('If you did not request this, reply to this email so the Pockit owner knows.'),
    ),
    textContent:
      'Your Pockit account and the budget data linked to it have been deleted. Thanks for letting Pockit be part of your money journey. If you did not request this, reply to this email so the Pockit owner knows.',
  }
}

export function signupEmail(email: string, confirmedAt: string) {
  const safeEmail = escapeHtml(email)
  const safeDate = escapeHtml(
    new Date(confirmedAt).toLocaleString('en-CA', {
      timeZone: 'UTC',
      dateStyle: 'medium',
      timeStyle: 'short',
    }),
  )
  return {
    subject: 'New confirmed Pockit signup',
    htmlContent: layout(
      'OWNER UPDATE',
      'Someone joined Pockit.',
      paragraph(
        `A new account confirmed its email address: <strong style="color:#f2f7ed">${safeEmail}</strong>`,
      ) +
        paragraph(`Confirmed: ${safeDate} UTC`) +
        paragraph(
          'This alert includes only the account email and confirmation time. It does not include their budget or financial details.',
        ),
    ),
    textContent: `New confirmed Pockit signup. Email: ${email}. Confirmed: ${safeDate} UTC. No budget or financial details are included.`,
  }
}

export async function sendEmail(to: string, message: ReturnType<typeof deletionEmail>) {
  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'api-key': requiredEnv('BREVO_API_KEY') },
    body: JSON.stringify({
      sender: { name: 'Pockit', email: requiredEnv('POCKIT_SENDER_EMAIL') },
      replyTo: { email: requiredEnv('POCKIT_ADMIN_EMAIL') },
      to: [{ email: to }],
      ...message,
    }),
  })
  if (!response.ok) throw new Error(`Email provider returned HTTP ${response.status}`)
}
