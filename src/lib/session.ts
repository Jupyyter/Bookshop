import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import { auth, type User } from "@/lib/auth";

// Who is signed in right now, or null. Reads the session cookie and checks it against the database.
// cache() makes every call during one page render share a single lookup.
export const getCurrentUser = cache(async (): Promise<User | null> => {
  // Only ever answer this while handling a real visitor's request, never while Next.js pre-builds a
  // page ahead of time: checking the session compares its expiry with the current time (new Date()),
  // and the answer differs for every visitor anyway. Same reason readCart() starts with this.
  await connection();
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user ?? null;
});

// For pages that only make sense signed in: send everyone else to sign in, then back here.
export async function requireUser(returnTo: string): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect(`/sign-in?next=${encodeURIComponent(returnTo)}`);
  return user;
}

// Where to go after signing in. Only paths on this site are allowed: otherwise a link like
// /sign-in?next=https://evil.example could bounce people to a fake copy of the shop.
export function safeNextPath(value: unknown, fallback = "/account"): string {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//") && !value.startsWith("/\\")
    ? value
    : fallback;
}