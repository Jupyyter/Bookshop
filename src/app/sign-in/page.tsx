import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { GoogleButton, Notice, SignInForm } from "@/components/auth-forms";
import { googleSignInEnabled } from "@/lib/auth";
import { getCurrentUser, safeNextPath } from "@/lib/session";

export const metadata: Metadata = { title: "Sign in" };

type SearchParams = PageProps<"/sign-in">["searchParams"];

export default function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  return (
    <main className="mx-auto w-full max-w-sm px-6 py-12 font-sans">
      <h1 className="text-3xl font-bold tracking-tight">Sign in</h1>
      <Suspense fallback={null}>
        <SignInContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function SignInContent({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const next = safeNextPath(params.next);
  if (await getCurrentUser()) redirect(next); // already signed in

  return (
    <>
      {params.reset && (
        <div className="mt-6">
          <Notice>Your password was changed. Sign in with the new one.</Notice>
        </div>
      )}
      {typeof params.error === "string" && (
        <div className="mt-6">
          <Notice>{errorMessage(params.error)}</Notice>
        </div>
      )}
      {googleSignInEnabled && <GoogleButton next={next} />}
      <SignInForm next={next} />
    </>
  );
}

// Messages for the ?error=… that lands here: from our own expired-link redirect, or from Better Auth
// when signing in with Google didn't work out.
function errorMessage(code: string): string {
  switch (code) {
    case "invalid_link":
      return "That link has expired or was already used. Sign in and we'll email you a fresh one.";
    case "account_not_linked":
      return "There's already an account with this email, but it hasn't been confirmed yet. Open the confirmation link we emailed you, then Google sign-in will work too.";
    case "access_denied":
      return "Google sign-in was cancelled.";
    default:
      return "Signing in with Google didn't work. Try again, or sign in with your email.";
  }
}
