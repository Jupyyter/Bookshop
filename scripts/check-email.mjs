// Checks the email settings in .env.local without starting the site.
//   node scripts/check-email.mjs                  → shows the settings and tries to log in
//   node scripts/check-email.mjs you@example.com  → also sends a test email there
import nodemailer from "nodemailer";

try {
  process.loadEnvFile(".env.local");
} catch {
  console.error("Couldn't read .env.local. Run this from the project folder (D:\\bookshop).");
  process.exit(1);
}

const smtpUrl = process.env.SMTP_URL;
const from = process.env.EMAIL_FROM;
if (!smtpUrl) {
  console.error("SMTP_URL is missing from .env.local.");
  process.exit(1);
}

let url;
try {
  url = new URL(smtpUrl.trim());
} catch {
  console.error("SMTP_URL isn't a valid address. Look for stray spaces or quotes.");
  process.exit(1);
}
const user = decodeURIComponent(url.username);
const pass = decodeURIComponent(url.password);
const isGmail = url.hostname === "smtp.gmail.com" || /@(gmail|googlemail)\.com$/i.test(user);

// Show what will be sent, with the password hidden except for its first and last letter.
console.log("Server:   ", url.hostname, "port", url.port || "(default)");
console.log("Username: ", user || "(none)");
console.log("Password: ", pass ? `${pass[0]}${"•".repeat(Math.max(pass.length - 2, 0))}${pass.at(-1)} (${pass.length} characters)` : "(none)");
console.log("Sender:   ", from ?? "(EMAIL_FROM is missing)");
console.log();

const problems = [];
if (/\s/.test(pass)) problems.push("The password contains spaces. Remove them: Google only shows them to make it easier to read.");
if (isGmail && pass.replace(/\s/g, "").length !== 16) problems.push("Gmail app passwords are exactly 16 letters. This doesn't look like one; is it your normal password?");
if (isGmail && !/^[a-z]{16}$/i.test(pass.replace(/\s/g, ""))) problems.push("Gmail app passwords contain only letters.");
if (from && user && !from.includes(user)) problems.push(`EMAIL_FROM isn't ${user}. Gmail will send from ${user} anyway.`);
for (const problem of problems) console.log("⚠ ", problem);
if (problems.length > 0) console.log();

const transporter = nodemailer.createTransport(smtpUrl.trim());
try {
  await transporter.verify();
  console.log("✅ The mail server accepted the login.");
} catch (error) {
  console.log("❌ Login failed:", error.response ?? error.message);
  if (error.responseCode === 535) {
    console.log("   The server rejected this username + password pair. The usual causes:");
    console.log("   - the app password was created while signed in to a different Google account than the username");
    console.log("   - the normal Gmail password was used instead of an app password");
    console.log("   - a typo in the address or the password");
  }
  process.exit(1);
}

const to = process.argv[2];
if (to) {
  await transporter.sendMail({
    from: from ?? user,
    to,
    subject: "Bookshop test email",
    text: "If you can read this, the shop can send emails.",
  });
  console.log(`✅ Test email sent to ${to}. Check the inbox and the spam folder.`);
}
