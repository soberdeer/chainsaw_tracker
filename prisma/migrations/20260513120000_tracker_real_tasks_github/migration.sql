-- CreateEnum
CREATE TYPE "ExternalSource" AS ENUM ('CLICKUP', 'LOCAL');

-- CreateEnum
CREATE TYPE "ActivityEventType" AS ENUM ('TASK_IMPORTED_FROM_CLICKUP', 'TASK_CREATED', 'TASK_UPDATED', 'TASK_STATUS_CHANGED', 'TASK_ASSIGNEE_CHANGED', 'TASK_MILESTONE_CHANGED', 'TASK_LINKED_TO_GITHUB_BRANCH', 'TASK_LINKED_TO_GITHUB_PR', 'GITHUB_PR_OPENED', 'GITHUB_PR_READY_FOR_REVIEW', 'GITHUB_PR_REVIEW_REQUESTED', 'GITHUB_PR_APPROVED', 'GITHUB_PR_CHANGES_REQUESTED', 'GITHUB_PR_REVIEW_COMMENTED', 'GITHUB_PR_MERGED', 'GITHUB_PR_CLOSED');

-- CreateEnum
CREATE TYPE "GitHubProvider" AS ENUM ('GITHUB');

-- CreateEnum
CREATE TYPE "GitHubPullRequestState" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "GitHubReviewStatus" AS ENUM ('NONE', 'REVIEW_REQUESTED', 'IN_REVIEW', 'APPROVED', 'CHANGES_REQUESTED', 'COMMENTED', 'MERGED', 'CLOSED');

-- CreateEnum
CREATE TYPE "TaskGitHubLinkType" AS ENUM ('BRANCH', 'COMMIT', 'PULL_REQUEST');

-- AlterEnum
ALTER TYPE "WorkspaceRole" ADD VALUE 'LEAD';

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "departmentId" TEXT,
ADD COLUMN     "externalDescription" TEXT,
ADD COLUMN     "externalId" TEXT,
ADD COLUMN     "externalSource" "ExternalSource" NOT NULL DEFAULT 'LOCAL',
ADD COLUMN     "externalStatus" TEXT,
ADD COLUMN     "externalTitle" TEXT,
ADD COLUMN     "externalUrl" TEXT,
ADD COLUMN     "listId" TEXT,
ADD COLUMN     "locallyEditedAt" TIMESTAMP(3),
ADD COLUMN     "milestoneId" TEXT,
ADD COLUMN     "syncedAt" TIMESTAMP(3),
ADD COLUMN     "taskKey" TEXT,
ADD COLUMN     "teamId" TEXT,
ADD COLUMN     "workspaceId" TEXT;

WITH task_scope AS (
  SELECT
    t."id",
    s."workspaceId",
    f."spaceId" AS "departmentId",
    t."folderId" AS "teamId",
    t."taskListId" AS "listId"
  FROM "Task" t
  JOIN "Folder" f ON f."id" = t."folderId"
  JOIN "Space" s ON s."id" = f."spaceId"
)
UPDATE "Task" t
SET
  "workspaceId" = task_scope."workspaceId",
  "departmentId" = task_scope."departmentId",
  "teamId" = task_scope."teamId",
  "listId" = task_scope."listId"
FROM task_scope
WHERE t."id" = task_scope."id";

WITH imported AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (PARTITION BY "sourceExternalId" ORDER BY "createdAt" ASC, "id" ASC) AS rn
  FROM "Task"
  WHERE "sourceExternalId" IS NOT NULL AND "sourceExternalId" <> ''
)
UPDATE "Task" t
SET
  "externalSource" = 'CLICKUP',
  "externalId" = t."sourceExternalId",
  "externalUrl" = t."sourceUrl",
  "externalTitle" = t."title",
  "externalDescription" = t."description",
  "externalStatus" = t."status",
  "syncedAt" = t."updatedAt"
FROM imported
WHERE t."id" = imported."id" AND imported.rn = 1;

WITH keyed AS (
  SELECT
    "id",
    "workspaceId",
    "createdAt",
    UPPER((regexp_match("title", '(CL-(PROTO|VRS|ALP|BET|RC|R)-[0-9]{3}(\\.[0-9]{2})?)', 'i'))[1]) AS key
  FROM "Task"
), unique_keyed AS (
  SELECT
    "id",
    key,
    ROW_NUMBER() OVER (PARTITION BY "workspaceId", key ORDER BY "createdAt" ASC, "id" ASC) AS rn
  FROM keyed
  WHERE key IS NOT NULL
)
UPDATE "Task" t
SET "taskKey" = unique_keyed.key
FROM unique_keyed
WHERE t."id" = unique_keyed."id" AND unique_keyed.rn = 1;

-- CreateTable
CREATE TABLE "Milestone" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "folderId" TEXT,
    "title" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Milestone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "actorId" TEXT,
    "type" "ActivityEventType" NOT NULL,
    "message" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GitHubRepository" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "provider" "GitHubProvider" NOT NULL DEFAULT 'GITHUB',
    "owner" TEXT NOT NULL,
    "repo" TEXT NOT NULL,
    "githubInstallationId" TEXT,
    "defaultBranch" TEXT NOT NULL DEFAULT 'main',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GitHubRepository_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GitHubPullRequest" (
    "id" TEXT NOT NULL,
    "repositoryId" TEXT NOT NULL,
    "taskId" TEXT,
    "githubPrId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "state" "GitHubPullRequestState" NOT NULL DEFAULT 'OPEN',
    "draft" BOOLEAN NOT NULL DEFAULT false,
    "isMerged" BOOLEAN NOT NULL DEFAULT false,
    "baseBranch" TEXT NOT NULL,
    "headBranch" TEXT NOT NULL,
    "headSha" TEXT NOT NULL,
    "authorLogin" TEXT,
    "reviewStatus" "GitHubReviewStatus" NOT NULL DEFAULT 'NONE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "syncedAt" TIMESTAMP(3),

    CONSTRAINT "GitHubPullRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GitHubBranch" (
    "id" TEXT NOT NULL,
    "repositoryId" TEXT NOT NULL,
    "taskId" TEXT,
    "name" TEXT NOT NULL,
    "lastCommitSha" TEXT,
    "url" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GitHubBranch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GitHubCommit" (
    "id" TEXT NOT NULL,
    "repositoryId" TEXT NOT NULL,
    "taskId" TEXT,
    "sha" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "authorName" TEXT,
    "authorEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GitHubCommit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskGitHubLink" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "repositoryId" TEXT NOT NULL,
    "branchId" TEXT,
    "pullRequestId" TEXT,
    "commitSha" TEXT,
    "linkType" "TaskGitHubLinkType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskGitHubLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Milestone_folderId_idx" ON "Milestone"("folderId");

-- CreateIndex
CREATE UNIQUE INDEX "Milestone_workspaceId_title_key" ON "Milestone"("workspaceId", "title");

-- CreateIndex
CREATE INDEX "ActivityLog_taskId_createdAt_idx" ON "ActivityLog"("taskId", "createdAt");

-- CreateIndex
CREATE INDEX "ActivityLog_workspaceId_idx" ON "ActivityLog"("workspaceId");

-- CreateIndex
CREATE INDEX "GitHubRepository_workspaceId_idx" ON "GitHubRepository"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "GitHubRepository_workspaceId_provider_owner_repo_key" ON "GitHubRepository"("workspaceId", "provider", "owner", "repo");

-- CreateIndex
CREATE INDEX "GitHubPullRequest_taskId_idx" ON "GitHubPullRequest"("taskId");

-- CreateIndex
CREATE UNIQUE INDEX "GitHubPullRequest_repositoryId_githubPrId_key" ON "GitHubPullRequest"("repositoryId", "githubPrId");

-- CreateIndex
CREATE UNIQUE INDEX "GitHubPullRequest_repositoryId_number_key" ON "GitHubPullRequest"("repositoryId", "number");

-- CreateIndex
CREATE INDEX "GitHubBranch_taskId_idx" ON "GitHubBranch"("taskId");

-- CreateIndex
CREATE UNIQUE INDEX "GitHubBranch_repositoryId_name_key" ON "GitHubBranch"("repositoryId", "name");

-- CreateIndex
CREATE INDEX "GitHubCommit_taskId_idx" ON "GitHubCommit"("taskId");

-- CreateIndex
CREATE UNIQUE INDEX "GitHubCommit_repositoryId_sha_key" ON "GitHubCommit"("repositoryId", "sha");

-- CreateIndex
CREATE INDEX "TaskGitHubLink_taskId_idx" ON "TaskGitHubLink"("taskId");

-- CreateIndex
CREATE INDEX "TaskGitHubLink_repositoryId_idx" ON "TaskGitHubLink"("repositoryId");

-- CreateIndex
CREATE UNIQUE INDEX "TaskGitHubLink_taskId_repositoryId_linkType_branchId_pullRe_key" ON "TaskGitHubLink"("taskId", "repositoryId", "linkType", "branchId", "pullRequestId", "commitSha");

-- CreateIndex
CREATE INDEX "Task_workspaceId_idx" ON "Task"("workspaceId");

-- CreateIndex
CREATE INDEX "Task_departmentId_idx" ON "Task"("departmentId");

-- CreateIndex
CREATE INDEX "Task_teamId_idx" ON "Task"("teamId");

-- CreateIndex
CREATE INDEX "Task_listId_idx" ON "Task"("listId");

-- CreateIndex
CREATE INDEX "Task_milestoneId_idx" ON "Task"("milestoneId");

-- CreateIndex
CREATE INDEX "Task_externalSource_externalId_idx" ON "Task"("externalSource", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "Task_workspaceId_taskKey_key" ON "Task"("workspaceId", "taskKey");

-- CreateIndex
CREATE UNIQUE INDEX "Task_externalSource_externalId_key" ON "Task"("externalSource", "externalId");

-- AddForeignKey
ALTER TABLE "Milestone" ADD CONSTRAINT "Milestone_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Milestone" ADD CONSTRAINT "Milestone_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "Folder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "Milestone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GitHubRepository" ADD CONSTRAINT "GitHubRepository_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GitHubPullRequest" ADD CONSTRAINT "GitHubPullRequest_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "GitHubRepository"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GitHubPullRequest" ADD CONSTRAINT "GitHubPullRequest_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GitHubBranch" ADD CONSTRAINT "GitHubBranch_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "GitHubRepository"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GitHubBranch" ADD CONSTRAINT "GitHubBranch_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GitHubCommit" ADD CONSTRAINT "GitHubCommit_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "GitHubRepository"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GitHubCommit" ADD CONSTRAINT "GitHubCommit_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskGitHubLink" ADD CONSTRAINT "TaskGitHubLink_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskGitHubLink" ADD CONSTRAINT "TaskGitHubLink_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "GitHubRepository"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskGitHubLink" ADD CONSTRAINT "TaskGitHubLink_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "GitHubBranch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskGitHubLink" ADD CONSTRAINT "TaskGitHubLink_pullRequestId_fkey" FOREIGN KEY ("pullRequestId") REFERENCES "GitHubPullRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
