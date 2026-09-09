import nextEnv from "@next/env";
import { defineConfig } from "prisma/config";

const { loadEnvConfig } = nextEnv;

loadEnvConfig(process.cwd());     // Load environment variables from .env.local and .env files

/** Prisma CLI uses the `DIRECT_URL` environment variable for migrations and introspection. 
  If it is not set, it falls back to `DATABASE_URL`. 
  The `DIRECT_URL` should point to a direct database endpoint, while `DATABASE_URL` can point to a pooled endpoint.
*/
const configuredMigrationUrl =
  process.env.DIRECT_URL ?? process.env.DATABASE_URL;

if (!configuredMigrationUrl) {
  throw new Error(
    "DIRECT_URL or DATABASE_URL must be configured in .env.local",
  );
}

// Neon uses `-pooler` in pooled hostnames. Prisma schema operations should use
// the equivalent direct endpoint. This is a no-op when DIRECT_URL is direct.
const directMigrationUrl = configuredMigrationUrl.replace("-pooler.", ".");

export default defineConfig({
  schema: "database/prisma/schema.prisma",
  migrations: {
    path: "database/prisma/migrations",
    seed: "tsx database/prisma/seed.ts",
  },
  datasource: {
    url: directMigrationUrl,
  },
});
