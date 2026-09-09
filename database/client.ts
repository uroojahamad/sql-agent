import "server-only";

import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "./generated/prisma/client";

// This is a singleton instance of Prisma Client that can be imported and used throughout the application.
const createDatabaseClient = () => {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is not configured");
  }

  // Create a new Prisma Client instance with the Neon adapter for connecting to the database.
  const adapter = new PrismaNeon({ connectionString });
  return new PrismaClient({ adapter });
}

// Ensure that the Prisma Client is a singleton in development to prevent multiple instances from being created during hot reloading.
const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createDatabaseClient> | undefined;
};

// Create a new Prisma Client instance if it doesn't already exist in the global scope.
export const db = globalForPrisma.prisma ?? createDatabaseClient();

// Assign the Prisma Client instance to the global scope in development mode to maintain a singleton.
if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
