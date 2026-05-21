ALTER TABLE "GitHubPullRequest"
ADD COLUMN "workPackageId" TEXT;

ALTER TABLE "GitHubBranch"
ADD COLUMN "workPackageId" TEXT;

ALTER TABLE "GitHubCommit"
ADD COLUMN "workPackageId" TEXT;

CREATE INDEX "GitHubPullRequest_workPackageId_idx" ON "GitHubPullRequest"("workPackageId");
CREATE INDEX "GitHubBranch_workPackageId_idx" ON "GitHubBranch"("workPackageId");
CREATE INDEX "GitHubCommit_workPackageId_idx" ON "GitHubCommit"("workPackageId");
