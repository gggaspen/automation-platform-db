/**
 * Automation Platform Database
 * Main export file
 */

// Prisma Client
export { default as prisma, disconnect, healthCheck } from "./client";

// Multi-tenant utilities
export * from "./utils/tenant";

// Common queries
export * from "./utils/queries";

// Deprecation middleware
export * from "./utils/deprecation-middleware";

// Re-export Prisma types
export type * from "@prisma/client";
