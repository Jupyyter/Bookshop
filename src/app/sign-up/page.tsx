import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { GoogleButton, SignUpForm } from "@/components/auth-forms";
import { googleSignInEnabled } from "@/lib/auth";
import { getCurrentUser, safeNextPath } from "@/lib/session";

export const metadata: Metadata = { title: "Create an account" };

type SearchParams = PageProps<"/sign-up">["searchParams"];

export default function SignUpPage({ searchParams }: PageProps<"/sign-up">) {
  return (
    <main className="mx-auto w-full max-w-sm px-6 py-12 font-sans">
      <h1 className="text-3xl font-bold tracking-tight">Create an account</h1>
      <p className="mt-2 text-zinc-500">
        Follow your orders from any device, and keep your cart between visits. Buying without an account works too.
      </p>
      <Suspense fallback={null}>
        <SignUpContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function SignUpContent({ searchParams }: { searchParams: SearchParams }) {
  const next = safeNextPath((await searchParams).next);
  if (await getCurrentUser()) redirect(next);
  return (
    <>
      {googleSignInEnabled && <GoogleButton next={next} />}
      <SignUpForm next={next} />
    </>
  );
}
