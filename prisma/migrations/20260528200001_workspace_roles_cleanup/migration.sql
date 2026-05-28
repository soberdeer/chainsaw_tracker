-- Step 2: Migrate existing data to new 3-role system
UPDATE "Membership"      SET role = 'ADMIN'  WHERE role = 'OWNER';
UPDATE "Membership"      SET role = 'MEMBER' WHERE role = 'LEAD';
UPDATE "Membership"      SET role = 'READER' WHERE role = 'VIEWER';

UPDATE "PermissionSet"   SET role = 'ADMIN'  WHERE role = 'OWNER';
UPDATE "PermissionSet"   SET role = 'MEMBER' WHERE role = 'LEAD';
UPDATE "PermissionSet"   SET role = 'READER' WHERE role = 'VIEWER';

UPDATE "SpacePermission" SET role = 'ADMIN'  WHERE role = 'OWNER';
UPDATE "SpacePermission" SET role = 'MEMBER' WHERE role = 'LEAD';
UPDATE "SpacePermission" SET role = 'READER' WHERE role = 'VIEWER';

UPDATE "Invite"          SET role = 'ADMIN'  WHERE role = 'OWNER';
UPDATE "Invite"          SET role = 'MEMBER' WHERE role = 'LEAD';
UPDATE "Invite"          SET role = 'READER' WHERE role = 'VIEWER';

-- Step 3: Drop DEFAULT constraints before changing type
ALTER TABLE "Membership" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "Invite"     ALTER COLUMN "role" DROP DEFAULT;

-- Step 4: Recreate enum with only 3 values
ALTER TYPE "WorkspaceRole" RENAME TO "WorkspaceRole_old";
CREATE TYPE "WorkspaceRole" AS ENUM ('ADMIN', 'MEMBER', 'READER');

ALTER TABLE "Membership"
  ALTER COLUMN "role" TYPE "WorkspaceRole"
  USING "role"::text::"WorkspaceRole";

ALTER TABLE "PermissionSet"
  ALTER COLUMN "role" TYPE "WorkspaceRole"
  USING "role"::text::"WorkspaceRole";

ALTER TABLE "SpacePermission"
  ALTER COLUMN "role" TYPE "WorkspaceRole"
  USING "role"::text::"WorkspaceRole";

ALTER TABLE "Invite"
  ALTER COLUMN "role" TYPE "WorkspaceRole"
  USING "role"::text::"WorkspaceRole";

DROP TYPE "WorkspaceRole_old";

-- Step 5: Restore DEFAULT 'MEMBER' on columns that had it
ALTER TABLE "Membership" ALTER COLUMN "role" SET DEFAULT 'MEMBER';
ALTER TABLE "Invite"     ALTER COLUMN "role" SET DEFAULT 'MEMBER';
