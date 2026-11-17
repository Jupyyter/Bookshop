import { button, DEMO_NOTICE, emailLayout, heading, linkFallback, paragraph } from "@/emails/layout";
import type { Email } from "@/lib/email";

// The emails Better Auth asks us to send. Better Auth creates the secret links; we only word and style them.

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || "there";
}

function accountEmail(opts: { subject: string; title: string; lines: string[]; url?: string; buttonLabel?: string }): Omit<Email, "to"> {
  const { subject, title, lines, url, buttonLabel } = opts;
  const text = [title, "", ...lines, ...(url ? ["", url] : []), "", DEMO_NOTICE].join("\n");
  const html = emailLayout({
    title: subject,
    preview: lines[0],
    body: `
      ${heading(title)}
      ${lines.map(paragraph).join("")}
      ${url && buttonLabel ? button(url, buttonLabel) + linkFallback(url) : ""}`,
  });
  return { subject, html, text };
}

export function verifyEmailEmail(name: string, url: string) {
  return accountEmail({
    subject: "Confirm your email for Bookshop",
    title: `Welcome, ${firstName(name)}!`,
    lines: [
      "Confirm your email address to finish creating your Bookshop account. The link works for 24 hours.",
      "If you didn't sign up, ignore this email and no account will be created.",
    ],
    url,
    buttonLabel: "Confirm my email",
  });
}

export function resetPasswordEmail(name: string, url: string) {
  return accountEmail({
    subject: "Reset your Bookshop password",
    title: `Hi ${firstName(name)},`,
    lines: [
      "Someone asked to reset the password for your Bookshop account. The link works for 1 hour.",
      "If it wasn't you, ignore this email. Your password stays the same.",
    ],
    url,
    buttonLabel: "Choose a new password",
  });
}

// Sent when someone tries to sign up with an email that already has an account. The sign-up page
// shows the same "check your email" message either way, so nobody can use it to find out who has an account.
export function existingAccountEmail(name: string, signInUrl: string, resetUrl: string) {
  return accountEmail({
    subject: "You already have a Bookshop account",
    title: `Hi ${firstName(name)},`,
    lines: [
      "Someone tried to create a new Bookshop account with this email address, but you already have one.",
      `If it was you, sign in at ${signInUrl}, or choose a new password at ${resetUrl} if you forgot it.`,
      "If it wasn't you, you can ignore this email.",
    ],
  });
}
