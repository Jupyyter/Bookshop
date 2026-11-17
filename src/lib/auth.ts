import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { after } from "next/server";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { existingAccountEmail, resetPasswordEmail, verifyEmailEmail } from "@/emails/account";
import { type Email, sendEmail } from "@/lib/email";
import { moveGuestCartToAccount } from "@/lib/guest-cart";

// Accounts, sign-in and everything around them, handled by Better Auth.
// It hashes passwords, creates sessions, makes the secret links for confirming an email or
// resetting a password, and limits how often anyone can guess passwords. We tell it where the
// data lives and how to send emails; the browser talks to it through /api/auth/*.

const siteUrl = process.env.SITE_URL;

// "Continue with Google" only appears once both values are in .env.local, so the shop also runs without them.
const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
export const googleSignInEnabled = Boolean(googleClientId && googleClientSecret);

// Better Auth asks for emails to be sent WITHOUT waiting for them. If "reset my password" answered
// faster for unknown emails than for real accounts, an attacker could time the answers to learn
// who has an account here. after() sends the email once the response has already gone out.
function sendInBackground(email: Email) {
  after(async () => {
    try {
      await sendEmail(email);
    } catch (error) {
      console.error(`Could not send "${email.subject}":`, error);
    }
  });
}

export const auth = betterAuth({
  baseURL: siteUrl,
  // secret: read from BETTER_AUTH_SECRET. It signs the session cookies, so it must stay private.

  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
    usePlural: true, // tables are "users", "sessions"… like our "carts" and "orders"
  }),

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true, // no signing in until the email address is confirmed
    minPasswordLength: 8,
    revokeSessionsOnPasswordReset: true, // a new password signs out every other device
    sendResetPassword: async ({ user, url }) => {
      sendInBackground({ to: user.email, ...resetPasswordEmail(user.name, url) });
    },
    onExistingUserSignUp: async ({ user }) => {
      sendInBackground({
        to: user.email,
        ...existingAccountEmail(user.name, `${siteUrl}/sign-in`, `${siteUrl}/forgot-password`),
      });
    },
  },

  emailVerification: {
    sendOnSignUp: true,
    sendOnSignIn: true, // signing in before confirming sends a fresh link
    autoSignInAfterVerification: true, // clicking the link also signs you in
    expiresIn: 60 * 60 * 24, // the link works for 24 hours
    sendVerificationEmail: async ({ user, url }) => {
      sendInBackground({ to: user.email, ...verifyEmailEmail(user.name, url) });
    },
  },

  // Sign in with Google: Google proves who you are and tells us your name and (already verified) email.
  // We never see or store a Google password.
  socialProviders: googleSignInEnabled
    ? {
        google: {
          clientId: googleClientId!,
          clientSecret: googleClientSecret!,
          prompt: "select_account", // always let people pick which Google account to use
        },
      }
    : {},

  account: {
    // Google gives us access tokens we never use; if we keep them, keep them encrypted.
    encryptOAuthTokens: true,
    // Signing in with Google using the email of an existing account adds Google to that same
    // account (instead of making a second one). Better Auth only does that when both Google and
    // our own records say the email is verified, so nobody can pre-register someone else's email
    // with a password and wait for them to arrive through Google.
    accountLinking: { enabled: true },
  },

  // Counts sign-in attempts and similar requests per visitor. Kept in the database (instead of
  // memory) so the limits still hold when the site runs on several servers.
  rateLimit: { storage: "database" },

  databaseHooks: {
    session: {
      create: {
        // A new session means someone just signed in: bring along what they put in the cart as a guest.
        after: async (session) => {
          try {
            await moveGuestCartToAccount(session.userId);
          } catch (error) {
            console.error("Could not move the guest cart into the account:", error);
          }
        },
      },
    },
  },

  plugins: [nextCookies()], // lets server code refresh the session cookie (must be the last plugin)
});

export type User = typeof auth.$Infer.Session.user;
