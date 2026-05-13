ALTER TABLE "Task" ADD COLUMN "position" INTEGER NOT NULL DEFAULT 0;

WITH ranked AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "taskListId", "statusId"
      ORDER BY "createdAt" ASC, "id" ASC
    ) - 1 AS next_position
  FROM "Task"
)
UPDATE "Task"
SET "position" = ranked.next_position
FROM ranked
WHERE "Task"."id" = ranked."id";
