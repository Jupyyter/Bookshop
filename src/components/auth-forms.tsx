"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState } from "react";
import { authClient } from "@/lib/auth-client";

// The account forms. Each one calls Better Auth from the browser (authClient → /api/auth/*),
// where Better Auth checks the request's origin and limits repeated attempts.

// After an action, React clears the form. Returning what was typed (never passwords) and using it as
// defaultValue puts it back, so a typo in the password doesn't also wipe the email.
type FormState = { error?: string; done?: boolean; email?: string; name?: string } | null;
type AuthError = { status: number; code?: string; message?: string };

function describe(error: AuthError): string {
  if (error.status === 429) return "Too many attempts. Wait a minute, then try again.";
  return error.message || "Something went wrong. Please try again.";
}

const text = (form: FormData, name: string) => String(form.get(name) ?? "").trim();

// ---------- small building blocks ----------

const inputClass =
  "mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 outline-none focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:border-zinc-300";

function Field(props: {
  label: string;
  name: string;
  type?: string;
  autoComplete?: string;
  minLength?: number;
  defaultValue?: string;
}) {
  const { label, type = "text", ...input } = props;
  return (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      <input {...input} type={type} required maxLength={type === "password" ? 128 : 254} className={inputClass} />
    </label>
  );
}

function Submit({ pending, label, pendingLabel }: { pending: boolean; label: string; pendingLabel: string }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-lg bg-zinc-900 px-6 py-3 font-medium text-white transition hover:bg-zinc-700 disabled:opacity-60 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
    >
      {pending ? pendingLabel : label}
    </button>
  );
}

function ErrorMessage({ state }: { state: FormState }) {
  if (!state?.error) return null;
  return (
    <p role="alert" className="text-sm text-red-600 dark:text-red-400">
      {state.error}
    </p>
  );
}

export function Notice({ children }: { children: React.ReactNode }) {
  return <p className="rounded-lg bg-zinc-100 px-4 py-3 text-sm dark:bg-zinc-900">{children}</p>;
}

// ---------- sign in ----------

export function SignInForm({ next }: { next: string }) {
  const router = useRouter();
  const [state, action, pending] = useActionState<FormState, FormData>(async (_previous, form) => {
    const email = text(form, "email");
    const { error } = await authClient.signIn.email({
      email,
      password: String(form.get("password")),
      callbackURL: next, // where the "confirm your email" link leads, if one gets sent now
    });
    if (error) {
      if (error.status === 403) {
        return { email, error: `Confirm your email first. We just sent a new link to ${email}.` };
      }
      if (error.status === 401) return { email, error: "Wrong email or password." };
      return { email, error: describe(error) };
    }
    router.push(next);
    router.refresh(); // re-render server parts (like the header) now that you're signed in
    return { done: true };
  }, null);

  return (
    <form action={action} className="mt-8 space-y-4">
      <Field label="Email" name="email" type="email" autoComplete="email" defaultValue={state?.email} />
      <Field label="Password" name="password" type="password" autoComplete="current-password" />
      <ErrorMessage state={state} />
      <Submit pending={pending} label="Sign in" pendingLabel="Signing in…" />
      <p className="flex justify-between text-sm">
        <Link href="/forgot-password" className="underline">
          Forgot your password?
        </Link>
        <Link href={`/sign-up${next !== "/account" ? `?next=${encodeURIComponent(next)}` : ""}`} className="underline">
          Create an account
        </Link>
      </p>
    </form>
  );
}

// ---------- sign up ----------

export function SignUpForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(async (_previous, form) => {
    const email = text(form, "email");
    const name = text(form, "name");
    const { error } = await authClient.signUp.email({
      name,
      email,
      password: String(form.get("password")),
      callbackURL: next, // the confirmation link signs you in and lands here
    });
    if (error) return { name, email, error: describe(error) };
    return { done: true, email };
  }, null);

  if (state?.done) {
    return (
      <div className="mt-8 space-y-3">
        <h2 className="text-xl font-semibold">Check your email</h2>
        <p className="text-zinc-600 dark:text-zinc-400">
          We sent a link to <strong>{state.email}</strong>. Click it to confirm your address and finish creating your
          account. It works for 24 hours.
        </p>
        <p className="text-sm text-zinc-500">
          Nothing arrived? Look in your spam folder. If this email already has an account, we sent you a note about
          that instead.
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="mt-8 space-y-4">
      <Field label="Your name" name="name" autoComplete="name" defaultValue={state?.name} />
      <Field label="Email" name="email" type="email" autoComplete="email" defaultValue={state?.email} />
      <Field label="Password (at least 8 characters)" name="password" type="password" autoComplete="new-password" minLength={8} />
      <ErrorMessage state={state} />
      <Submit pending={pending} label="Create account" pendingLabel="Creating your account…" />
      <p className="text-sm">
        Already have an account?{" "}
        <Link href="/sign-in" className="underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}

// ---------- forgot / reset password ----------

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(async (_previous, form) => {
    const email = text(form, "email");
    const { error } = await authClient.requestPasswordReset({ email, redirectTo: "/reset-password" });
    if (error) return { email, error: describe(error) };
    return { done: true, email };
  }, null);

  if (state?.done) {
    return (
      <p className="mt-8 text-zinc-600 dark:text-zinc-400">
        If there&apos;s an account for <strong>{state.email}</strong>, a link to choose a new password is on its way. It
        works for 1 hour.
      </p>
    );
  }

  return (
    <form action={action} className="mt-8 space-y-4">
      <Field label="Email" name="email" type="email" autoComplete="email" defaultValue={state?.email} />
      <ErrorMessage state={state} />
      <Submit pending={pending} label="Send me a link" pendingLabel="Sending…" />
    </form>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [state, action, pending] = useActionState<FormState, FormData>(async (_previous, form) => {
    const newPassword = String(form.get("password"));
    if (newPassword !== String(form.get("confirm"))) return { error: "The two passwords don't match." };
    const { error } = await authClient.resetPassword({ newPassword, token });
    if (error) {
      if (error.status === 400 && error.code === "INVALID_TOKEN") {
        return { error: "This link has expired or was already used. Ask for a new one." };
      }
      return { error: describe(error) };
    }
    router.push("/sign-in?reset=1");
    return { done: true };
  }, null);

  return (
    <form action={action} className="mt-8 space-y-4">
      <Field label="New password (at least 8 characters)" name="password" type="password" autoComplete="new-password" minLength={8} />
      <Field label="Type it again" name="confirm" type="password" autoComplete="new-password" minLength={8} />
      <ErrorMessage state={state} />
      <Submit pending={pending} label="Save new password" pendingLabel="Saving…" />
    </form>
  );
}

// ---------- signed-in extras ----------

export function ChangePasswordForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(async (_previous, form) => {
    const newPassword = String(form.get("password"));
    if (newPassword !== String(form.get("confirm"))) return { error: "The two new passwords don't match." };
    const { error } = await authClient.changePassword({
      currentPassword: String(form.get("current")),
      newPassword,
      revokeOtherSessions: true, // sign out every other device, in case someone else knew the old password
    });
    if (error) {
      if (error.code === "INVALID_PASSWORD") return { error: "Your current password is wrong." };
      return { error: describe(error) };
    }
    return { done: true };
  }, null);

  return (
    <form action={action} className="mt-4 max-w-sm space-y-4">
      <Field label="Current password" name="current" type="password" autoComplete="current-password" />
      <Field label="New password (at least 8 characters)" name="password" type="password" autoComplete="new-password" minLength={8} />
      <Field label="Type the new one again" name="confirm" type="password" autoComplete="new-password" minLength={8} />
      <ErrorMessage state={state} />
      {state?.done && (
        <p role="status" className="text-sm text-green-700 dark:text-green-400">
          Password changed. Any other devices were signed out.
        </p>
      )}
      <Submit pending={pending} label="Change password" pendingLabel="Saving…" />
    </form>
  );
}

export function SignOutButton() {
  const router = useRouter();
  const [, action, pending] = useActionState<FormState>(async () => {
    await authClient.signOut();
    router.push("/");
    router.refresh();
    return null;
  }, null);

  return (
    <form action={action}>
      <button type="submit" disabled={pending} className="rounded-lg border border-zinc-300 px-4 py-2 font-medium hover:bg-zinc-100 disabled:opacity-60 dark:border-zinc-700 dark:hover:bg-zinc-900">
        {pending ? "Signing out…" : "Sign out"}
      </button>
    </form>
  );
}

// ---------- Google ----------

function GoogleLogo() {
  // Google's "G", drawn with their four brand colours.
  return (
    <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.6 13.3l7.9 6.2C12.4 13.6 17.7 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.4 5.8c4.3-4 6.9-9.9 6.9-17.2z" />
      <path fill="#FBBC05" d="M10.5 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.9-6.2C1 16.6 0 20.2 0 24s1 7.4 2.6 10.8l7.9-6.2z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.8c-2.1 1.4-4.8 2.3-8.5 2.3-6.3 0-11.6-4.1-13.5-9.9l-7.9 6.2C6.6 42.6 14.6 48 24 48z" />
    </svg>
  );
}

const googleButtonClass =
  "flex w-full items-center justify-center gap-3 rounded-lg border border-zinc-300 bg-white px-6 py-3 font-medium text-zinc-900 transition hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800";

// Sends the browser to Google. Google sends it back to /api/auth/callback/google, where Better Auth
// signs you in (creating the account the first time) and then forwards you to `next`.
export function GoogleButton({ next }: { next: string }) {
  const [state, action, pending] = useActionState<FormState>(async () => {
    const { error } = await authClient.signIn.social({
      provider: "google",
      callbackURL: next,
      errorCallbackURL: "/sign-in", // if anything goes wrong, come back here with ?error=…
    });
    if (error) return { error: describe(error) };
    return null; // the browser is already on its way to Google
  }, null);

  return (
    <form action={action} className="mt-8">
      <button type="submit" disabled={pending} className={googleButtonClass}>
        <GoogleLogo />
        {pending ? "Opening Google…" : "Continue with Google"}
      </button>
      <ErrorMessage state={state} />
      <div className="mt-6 flex items-center gap-3 text-sm text-zinc-500">
        <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
        or use your email
        <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
      </div>
    </form>
  );
}

// On the account page: add Google as a second way into an existing account.
export function ConnectGoogleButton() {
  const [state, action, pending] = useActionState<FormState>(async () => {
    const { error } = await authClient.linkSocial({
      provider: "google",
      callbackURL: "/account",
      errorCallbackURL: "/account",
    });
    if (error) return { error: describe(error) };
    return null;
  }, null);

  return (
    <form action={action}>
      <button type="submit" disabled={pending} className="flex items-center gap-2 rounded-lg border border-zinc-300 px-4 py-2 font-medium hover:bg-zinc-100 disabled:opacity-60 dark:border-zinc-700 dark:hover:bg-zinc-900">
        <GoogleLogo />
        {pending ? "Opening Google…" : "Connect Google"}
      </button>
      <ErrorMessage state={state} />
    </form>
  );
}
