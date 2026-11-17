import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ResetPasswordForm } from "@/components/auth-forms";

export const metadata: Metadata = { title: "Choose a new password" };

type SearchParams = PageProps<"/reset-password">["searchParams"];

// The link in the reset email goes through Better Auth (/api/auth/reset-password/…), which checks
// the token and sends the browser here with ?token=… (or ?error=INVALID_TOKEN).
export default function ResetPasswordPage({ searchParams }: PageProps<"/reset-password">) {
  return (
    <main className="mx-auto w-full max-w-sm px-6 py-12 font-sans">
      <h1 className="text-3xl font-bold tracking-tight">Choose a new password</h1>
      <Suspense fallback={null}>
        <ResetContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function ResetContent({ searchParams }: { searchParams: SearchParams }) {
  const { token, error } = await searchParams;
  if (error || typeof token !== "string" || token.length === 0) {
    return (
      <div className="mt-6">
        <p className="text-zinc-600 dark:text-zinc-400">This link has expired or was already used.</p>
        <Link href="/forgot-password" className="mt-4 inline-block underline">
          Send me a new link
        </Link>
      </div>
    );
  }
  return <ResetPasswordForm token={token} />;
}
