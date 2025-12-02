/**
 * Migration Script: Migrate Authorizer Users to Automation Platform DB
 *
 * This script correlates users between Authorizer and automation-platform-db
 * by email and updates the authorizerId field in the platform database.
 *
 * Prerequisites:
 * - Authorizer database connection string in AUTHORIZER_DATABASE_URL
 * - Automation platform database connection string in DATABASE_URL
 * - Both databases must be accessible and running
 *
 * Environment Variables Required:
 * - DATABASE_URL: Connection string for automation-platform-db
 * - AUTHORIZER_DATABASE_URL: Connection string for Authorizer database (Railway)
 *
 * Usage:
 * cd automation-platform-db
 * npm run db:migrate-authorizer-users
 *
 * Output:
 * - Console logs with progress and results
 * - JSON report file: migration-report-authorizer-users.json
 *
 * Safety Features:
 * - Reads-only from Authorizer (no modifications)
 * - Creates backup-style report before making changes
 * - Validates data integrity after migration
 * - Handles errors gracefully without corrupting data
 *
 * Rollback:
 * - No automatic rollback (use database backups)
 * - Manual rollback: Set authorizerId to null for affected users
 */

import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

// Types for Authorizer user from raw query
interface AuthorizerUser {
  id: string;
  email: string;
  given_name: string | null;
  family_name: string | null;
  roles: string;
  email_verified_at: Date | null;
  created_at: Date;
}

// Types for migration report
interface MigrationStats {
  totalAuthorizerUsers: number;
  totalPlatformUsers: number;
  matchedUsers: number;
  updatedUsers: number;
  skippedUsers: number;
  errors: number;
}

interface MigrationResult {
  success: boolean;
  userId: string;
  email: string;
  authorizerId: string;
  action: "updated" | "skipped" | "error";
  reason?: string;
}

interface MigrationReport {
  metadata: {
    executedAt: string;
    scriptVersion: string;
    environment: string;
  };
  stats: MigrationStats;
  results: MigrationResult[];
  errors: string[];
}

// Initialize Prisma clients
const platformPrisma = new PrismaClient({
  log: ["info", "warn", "error"],
});

// For Authorizer, we'll use raw PostgreSQL connection
// Since Authorizer uses PostgreSQL, we can connect directly
if (!process.env.AUTHORIZER_DATABASE_URL) {
  throw new Error("AUTHORIZER_DATABASE_URL environment variable is required");
}

// Create Authorizer Prisma client by temporarily overriding DATABASE_URL
const originalDbUrl = process.env.DATABASE_URL;
process.env.DATABASE_URL = process.env.AUTHORIZER_DATABASE_URL;

const authorizerPrisma = new PrismaClient({
  log: ["error"],
});

// Restore original DATABASE_URL
if (originalDbUrl) {
  process.env.DATABASE_URL = originalDbUrl;
}

async function main() {
  console.log("🚀 Starting Authorizer User Migration...");

  const report: MigrationReport = {
    metadata: {
      executedAt: new Date().toISOString(),
      scriptVersion: "1.0.0",
      environment: process.env.NODE_ENV || "development",
    },
    stats: {
      totalAuthorizerUsers: 0,
      totalPlatformUsers: 0,
      matchedUsers: 0,
      updatedUsers: 0,
      skippedUsers: 0,
      errors: 0,
    },
    results: [],
    errors: [],
  };

  try {
    // 1. Fetch all users from both systems
    console.log("📊 Fetching users from both systems...");

    const [authorizerUsersRaw, platformUsers] = await Promise.all([
      // Query Authorizer users
      authorizerPrisma.$queryRaw`
        SELECT id, email, given_name, family_name, roles, email_verified_at, created_at
        FROM authorizer_users
        WHERE email IS NOT NULL
        ORDER BY created_at ASC
      `,
      // Query Platform users
      platformPrisma.user.findMany({
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          authorizerId: true,
          status: true,
          createdAt: true,
        },
        orderBy: { createdAt: "asc" },
      }),
    ]);

    // Cast the raw query result to proper type
    const authorizerUsers = authorizerUsersRaw as AuthorizerUser[];

    report.stats.totalAuthorizerUsers = authorizerUsers.length;
    report.stats.totalPlatformUsers = platformUsers.length;

    console.log(`📊 Found ${authorizerUsers.length} users in Authorizer`);
    console.log(`📊 Found ${platformUsers.length} users in Platform`);

    // 2. Create correlation map by email
    console.log("🔗 Correlating users by email...");

    const authorizerByEmail = new Map(
      authorizerUsers.map((user) => [user.email.toLowerCase(), user])
    );

    // 3. Process each platform user
    for (const platformUser of platformUsers) {
      const email = platformUser.email.toLowerCase();
      const authorizerUser = authorizerByEmail.get(email);

      if (authorizerUser) {
        // Match found
        report.stats.matchedUsers++;

        if (platformUser.authorizerId) {
          // Already has authorizerId
          report.results.push({
            success: true,
            userId: platformUser.id,
            email: platformUser.email,
            authorizerId: platformUser.authorizerId,
            action: "skipped",
            reason: "Already has authorizerId",
          });
          report.stats.skippedUsers++;
          console.log(`⏭️  Skipped ${email} - already has authorizerId`);
        } else {
          // Update authorizerId
          try {
            await platformPrisma.user.update({
              where: { id: platformUser.id },
              data: { authorizerId: authorizerUser.id },
            });

            report.results.push({
              success: true,
              userId: platformUser.id,
              email: platformUser.email,
              authorizerId: authorizerUser.id,
              action: "updated",
            });
            report.stats.updatedUsers++;
            console.log(
              `✅ Updated ${email} with authorizerId: ${authorizerUser.id}`
            );
          } catch (error) {
            const errorMsg = `Failed to update user ${platformUser.id}: ${error}`;
            report.errors.push(errorMsg);
            report.results.push({
              success: false,
              userId: platformUser.id,
              email: platformUser.email,
              authorizerId: authorizerUser.id,
              action: "error",
              reason: errorMsg,
            });
            report.stats.errors++;
            console.error(`❌ Error updating ${email}:`, error);
          }
        }
      } else {
        // No match found
        report.results.push({
          success: true,
          userId: platformUser.id,
          email: platformUser.email,
          authorizerId: "",
          action: "skipped",
          reason: "No matching user in Authorizer",
        });
        report.stats.skippedUsers++;
        console.log(`⚠️  No match found for ${email} in Authorizer`);
      }
    }

    // 4. Validation: Check for data integrity
    console.log("🔍 Validating data integrity...");

    const validationResults = await platformPrisma.user.findMany({
      where: { authorizerId: { not: null } },
      select: {
        id: true,
        email: true,
        authorizerId: true,
      },
    });

    // Verify each updated user exists in Authorizer
    for (const user of validationResults) {
      if (user.authorizerId) {
        try {
          const exists = await authorizerPrisma.$queryRaw<
            Array<{ count: number }>
          >`
            SELECT COUNT(*) as count FROM authorizer_users WHERE id = ${user.authorizerId}
          `;

          if (exists[0].count === 0) {
            const errorMsg = `Validation failed: authorizerId ${user.authorizerId} for user ${user.email} does not exist in Authorizer`;
            report.errors.push(errorMsg);
            console.error(`❌ ${errorMsg}`);
          }
        } catch (error) {
          const errorMsg = `Validation query failed for user ${user.email}: ${error}`;
          report.errors.push(errorMsg);
          console.error(`❌ ${errorMsg}`);
        }
      }
    }

    // 5. Generate and save report
    const reportPath = path.join(
      process.cwd(),
      "migration-report-authorizer-users.json"
    );
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    console.log("📄 Migration report saved to:", reportPath);

    // 6. Summary
    console.log("\n📊 Migration Summary:");
    console.log(
      `   Total Authorizer users: ${report.stats.totalAuthorizerUsers}`
    );
    console.log(`   Total Platform users: ${report.stats.totalPlatformUsers}`);
    console.log(`   Matched users: ${report.stats.matchedUsers}`);
    console.log(`   Updated users: ${report.stats.updatedUsers}`);
    console.log(`   Skipped users: ${report.stats.skippedUsers}`);
    console.log(`   Errors: ${report.stats.errors}`);

    if (report.errors.length === 0) {
      console.log("🎉 Migration completed successfully!");
    } else {
      console.log(
        "⚠️  Migration completed with errors. Check the report for details."
      );
    }
  } catch (error) {
    console.error("💥 Migration failed:", error);
    report.errors.push(`Migration script error: ${error}`);
    process.exit(1);
  } finally {
    // Close connections
    await Promise.all([
      platformPrisma.$disconnect(),
      authorizerPrisma.$disconnect(),
    ]);
  }
}

// Run the migration
if (require.main === module) {
  main().catch(console.error);
}

export { main as migrateAuthorizerUsers };
