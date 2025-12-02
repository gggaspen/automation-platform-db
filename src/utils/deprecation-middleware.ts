/**
 * Prisma Middleware for Deprecated Fields
 *
 * Logs warnings when deprecated fields are accessed
 */

import { PrismaClient } from "@prisma/client";

const DEPRECATED_FIELDS = ["passwordHash", "emailVerified"];

export function setupDeprecationMiddleware(prisma: PrismaClient) {
  // @ts-ignore - Prisma middleware API
  prisma.$use(async (params, next) => {
    // Check if this is a query that selects deprecated fields
    if (params.model === "User" && params.action === "findUnique") {
      const select = params.args?.select as Record<string, boolean> | undefined;
      if (select) {
        const accessedDeprecatedFields = DEPRECATED_FIELDS.filter(
          (field) => select[field]
        );
        if (accessedDeprecatedFields.length > 0) {
          console.warn(
            `⚠️ DEPRECATED FIELD ACCESS: The following User fields are deprecated and will be removed in FASE 5: ${accessedDeprecatedFields.join(
              ", "
            )}. ` +
              `These fields are now handled by Authorizer. Please update your queries to not select these fields.`
          );
        }
      }
    }

    if (params.model === "User" && params.action === "findMany") {
      const select = params.args?.select as Record<string, boolean> | undefined;
      if (select) {
        const accessedDeprecatedFields = DEPRECATED_FIELDS.filter(
          (field) => select[field]
        );
        if (accessedDeprecatedFields.length > 0) {
          console.warn(
            `⚠️ DEPRECATED FIELD ACCESS: The following User fields are deprecated and will be removed in FASE 5: ${accessedDeprecatedFields.join(
              ", "
            )}. ` +
              `These fields are now handled by Authorizer. Please update your queries to not select these fields.`
          );
        }
      }
    }

    if (params.model === "User" && params.action === "findFirst") {
      const select = params.args?.select as Record<string, boolean> | undefined;
      if (select) {
        const accessedDeprecatedFields = DEPRECATED_FIELDS.filter(
          (field) => select[field]
        );
        if (accessedDeprecatedFields.length > 0) {
          console.warn(
            `⚠️ DEPRECATED FIELD ACCESS: The following User fields are deprecated and will be removed in FASE 5: ${accessedDeprecatedFields.join(
              ", "
            )}. ` +
              `These fields are now handled by Authorizer. Please update your queries to not select these fields.`
          );
        }
      }
    }

    // For create/update operations, warn if deprecated fields are being set
    if (
      params.model === "User" &&
      (params.action === "create" ||
        params.action === "update" ||
        params.action === "upsert")
    ) {
      const data = params.args?.data as Record<string, any> | undefined;
      if (data) {
        const usedDeprecatedFields = DEPRECATED_FIELDS.filter((field) =>
          data.hasOwnProperty(field)
        );
        if (usedDeprecatedFields.length > 0) {
          console.warn(
            `⚠️ DEPRECATED FIELD USAGE: Attempting to ${
              params.action
            } User with deprecated fields: ${usedDeprecatedFields.join(
              ", "
            )}. ` +
              `These fields are now handled by Authorizer and should not be set directly. This operation may be ignored or cause issues.`
          );
        }
      }
    }

    return next(params);
  });
}
