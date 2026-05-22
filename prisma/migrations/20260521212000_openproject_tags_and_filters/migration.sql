CREATE TABLE "OpenProjectTag" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OpenProjectTag_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OpenProjectWorkPackageTag" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "projectId" TEXT,
    "workPackageId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OpenProjectWorkPackageTag_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OpenProjectTag_workspaceId_normalizedName_key"
ON "OpenProjectTag"("workspaceId", "normalizedName");

CREATE INDEX "OpenProjectTag_workspaceId_name_idx"
ON "OpenProjectTag"("workspaceId", "name");

CREATE UNIQUE INDEX "OpenProjectWorkPackageTag_workspaceId_workPackageId_tagId_key"
ON "OpenProjectWorkPackageTag"("workspaceId", "workPackageId", "tagId");

CREATE INDEX "OpenProjectWorkPackageTag_workspaceId_projectId_idx"
ON "OpenProjectWorkPackageTag"("workspaceId", "projectId");

CREATE INDEX "OpenProjectWorkPackageTag_workspaceId_workPackageId_idx"
ON "OpenProjectWorkPackageTag"("workspaceId", "workPackageId");

CREATE INDEX "OpenProjectWorkPackageTag_tagId_idx"
ON "OpenProjectWorkPackageTag"("tagId");

ALTER TABLE "OpenProjectTag"
ADD CONSTRAINT "OpenProjectTag_workspaceId_fkey"
FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OpenProjectWorkPackageTag"
ADD CONSTRAINT "OpenProjectWorkPackageTag_workspaceId_fkey"
FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OpenProjectWorkPackageTag"
ADD CONSTRAINT "OpenProjectWorkPackageTag_tagId_fkey"
FOREIGN KEY ("tagId") REFERENCES "OpenProjectTag"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
