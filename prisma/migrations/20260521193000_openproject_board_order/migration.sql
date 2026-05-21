-- CreateTable
CREATE TABLE "OpenProjectBoardCardOrder" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "taskListId" TEXT NOT NULL,
    "statusId" TEXT NOT NULL,
    "workPackageId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OpenProjectBoardCardOrder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OpenProjectBoardCardOrder_workspaceId_taskListId_statusId_wo_key"
ON "OpenProjectBoardCardOrder"("workspaceId", "taskListId", "statusId", "workPackageId");

-- CreateIndex
CREATE INDEX "OpenProjectBoardCardOrder_workspaceId_taskListId_statusId_pos_idx"
ON "OpenProjectBoardCardOrder"("workspaceId", "taskListId", "statusId", "position");

-- CreateIndex
CREATE INDEX "OpenProjectBoardCardOrder_workspaceId_taskListId_workPackageId_idx"
ON "OpenProjectBoardCardOrder"("workspaceId", "taskListId", "workPackageId");

-- AddForeignKey
ALTER TABLE "OpenProjectBoardCardOrder"
ADD CONSTRAINT "OpenProjectBoardCardOrder_workspaceId_fkey"
FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
