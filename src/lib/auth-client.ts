import { createAuthClient } from "better-auth/react";

// The browser side of Better Auth: functions like authClient.signIn.email() that call /api/auth/*.
// Going through those URLs (instead of a Server Action) is what applies Better Auth's rate limits.
export const authClient = createAuthClient();
