-- CreateEnum
CREATE TYPE "UserSource" AS ENUM ('LOCAL', 'CLICKUP_IMPORTED', 'MANUALLY_INVITED', 'OPENPROJECT_EXISTING', 'OWNER_SEED');

-- DropIndex
DROP INDEX "Task_deletedAt_idx";

-- AlterTable
ALTER TABLE "Membership" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "PermissionSet" ADD COLUMN     "manageImports" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "manageIntegrations" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "viewReports" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "lastLoginAt" TIMESTAMP(3),
ADD COLUMN     "openProjectLogin" TEXT,
ADD COLUMN     "openProjectUserId" TEXT,
ADD COLUMN     "source" "UserSource",
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Workspace" ADD COLUMN     "avatarUrl" TEXT,
ADD COLUMN     "color" TEXT,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
