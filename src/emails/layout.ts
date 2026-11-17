import { escapeHtml } from "@/lib/email";

// The frame every email shares: grey background, white card, shop name, small print at the bottom.
// Email apps are far behind web browsers (no flexbox, no stylesheets in Gmail and Outlook),
// so this uses old-school tables and inline styles. That's normal for email, not a mistake.

export const MUTED = "color:#71717a";

export function emailLayout({ title, preview, body }: { title: string; preview: string; body: string }): string {
  const e = escapeHtml;
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${e(title)}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;color:#18181b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
  <!-- Preview text: the grey line inbox lists show next to the subject. Hidden in the email itself. -->
  <div style="display:none;max-height:0;overflow:hidden">${e(preview)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5">
    <tr>
      <td align="center" style="padding:32px 16px">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px">
          <tr>
            <td style="padding:32px">
              <p style="margin:0;font-size:18px;font-weight:700">Bookshop</p>
              ${body}
            </td>
          </tr>
        </table>
        <p style="max-width:560px;margin:16px 0 0;font-size:12px;line-height:1.5;${MUTED}">${e(DEMO_NOTICE)}</p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export const DEMO_NOTICE = "This is a demo shop paid in Stripe test mode. The courier is simulated, so no books actually ship.";

export function heading(text: string): string {
  return `<h1 style="margin:24px 0 8px;font-size:24px">${escapeHtml(text)}</h1>`;
}

export function paragraph(text: string): string {
  return `<p style="margin:0 0 12px;line-height:1.5;color:#52525b">${escapeHtml(text)}</p>`;
}

export function button(url: string, label: string): string {
  return `<p style="margin:24px 0 32px">
    <a href="${escapeHtml(url)}" style="display:inline-block;background:#18181b;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600">${escapeHtml(label)}</a>
  </p>`;
}

// Shown under a button, for email apps that block buttons or when the link must be copied by hand.
export function linkFallback(url: string): string {
  const e = escapeHtml;
  return `<p style="margin:0;font-size:13px;line-height:1.5;${MUTED}">If the button doesn't work, copy this link into your browser:<br>
    <a href="${e(url)}" style="color:#52525b;word-break:break-all">${e(url)}</a></p>`;
}
