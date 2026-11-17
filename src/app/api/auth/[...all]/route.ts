import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth";

// Every Better Auth URL (/api/auth/sign-in/email, /api/auth/verify-email, …) is answered here.
export const { GET, POST } = toNextJsHandler(auth);
