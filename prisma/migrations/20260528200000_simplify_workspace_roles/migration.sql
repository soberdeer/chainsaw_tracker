-- Simplify WorkspaceRole: OWNER/ADMIN/LEAD/MEMBER/VIEWER → ADMIN/MEMBER/READER
-- Step 1: Add READER to the existing enum FIRST (before any data migration)
ALTER TYPE "WorkspaceRole" ADD VALUE IF NOT EXISTS 'READER';
