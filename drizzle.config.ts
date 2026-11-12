import { defineConfig } from "drizzle-kit";

// Next.js loads .env.local by itself, but drizzle-kit runs outside Next.js, so load it here.
try {
  process.loadEnvFile(".env.local");
} catch {
  // no .env.local (for example on a server): DATABASE_URL must already be set
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts", // where the tables are described in TypeScript
  out: "./drizzle", // where the generated SQL migration files go
  dbCredentials: { url: process.env.DATABASE_URL! },
  strict: true, // ask before running anything that could delete data
});