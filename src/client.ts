/**
 * Prisma Client Singleton
 *
 * This module exports a single instance of PrismaClient to be used
 * throughout the application. This prevents issues with multiple
 * instances and connection pool exhaustion.
 */

import { PrismaClient } from "@prisma/client";

// Extend PrismaClient with custom methods if needed
const prismaClientSingleton = () => {
  const prisma = new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "info", "warn", "error"]
        : ["error"],
  });

  return prisma;
};

declare global {
  // eslint-disable-next-line no-var
  var prisma: undefined | ReturnType<typeof prismaClientSingleton>;
}

const prisma = globalThis.prisma ?? prismaClientSingleton();

if (process.env.NODE_ENV !== "production") {
  globalThis.prisma = prisma;
}

export default prisma;

/**
 * Disconnect Prisma Client
 * Use this to gracefully close the connection
 */
export async function disconnect(): Promise<void> {
  await prisma.$disconnect();
}

/**
 * Health check for database connection
 */
export async function healthCheck(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    console.error("Database health check failed:", error);
    return false;
  }
}
