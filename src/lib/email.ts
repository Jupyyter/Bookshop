import nodemailer, { type Transporter } from "nodemailer";

// Sends email over SMTP, the standard protocol every email provider speaks.
// Which server receives it depends only on SMTP_URL:
//   on your computer → Mailpit (catches everything, nothing reaches a real inbox)
//   on a real server → your provider, e.g. smtps://resend:API_KEY@smtp.resend.com:465
// The rest of the app only ever calls sendEmail(), so switching providers never touches it.

export type Email = {
  to: string;
  subject: string;
  html: string; // what most email apps show
  text: string; // plain version for apps that can't show HTML (and spam filters like seeing one)
};

let transporter: Transporter | undefined;

function getTransporter(): Transporter {
  const url = process.env.SMTP_URL;
  if (!url) throw new Error("SMTP_URL is not set. Add it to .env.local (see .env.example).");
  transporter ??= nodemailer.createTransport(url);
  return transporter;
}

export async function sendEmail(email: Email): Promise<void> {
  const from = process.env.EMAIL_FROM;
  if (!from) throw new Error("EMAIL_FROM is not set. Add it to .env.local (see .env.example).");
  await getTransporter().sendMail({ from, ...email });
}

// Text that came from somewhere else (book titles from Open Library, names and addresses typed
// on the payment page) must never be read as HTML. Otherwise a name like "<a href=...>" would
// turn into a real link inside our email. React does this for web pages automatically;
// in a hand-built email we have to do it ourselves.
export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
