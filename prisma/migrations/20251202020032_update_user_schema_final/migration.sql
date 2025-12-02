/*
  Warnings:

  - You are about to drop the column `emailVerified` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `passwordHash` on the `users` table. All the data in the column will be lost.
  - Made the column `authorizerId` on table `users` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "users" DROP COLUMN "emailVerified",
DROP COLUMN "passwordHash",
ALTER COLUMN "authorizerId" SET NOT NULL,
ALTER COLUMN "status" SET DEFAULT 'ACTIVE';
