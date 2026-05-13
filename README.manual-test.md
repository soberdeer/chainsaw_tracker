# Manual verification

## Local setup

1. Start PostgreSQL:
   `npm run db:up`
2. Apply migrations and generate Prisma Client:
   `npx prisma migrate deploy && npm run prisma:generate`
3. Seed the workspace and ClickUp export:
   `npm exec tsx prisma/seed.ts`
4. Start the app:
   `npm run dev`

Required env for the core tracker:

- `DATABASE_URL`
- `PORT`
- `CLIENT_URL`

No GitHub env variables are required for task list, task detail, ClickUp seed, CRUD, or Activity.

Optional existing GitHub env:

- `GITHUB_INTEGRATION_ENABLED=true`
- `GITHUB_WEBHOOK_SECRET`
- `GITHUB_TOKEN`
- future placeholders: `GITHUB_APP_ID`, `GITHUB_PRIVATE_KEY`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`

When GitHub is disabled or env is absent, the core tracker still starts and GitHub-dependent API calls return an empty/disabled response instead of blocking tasks.

## ClickUp import

Run:

`npm exec tsx prisma/seed.ts`

Run it a second time. The summary should show updates without duplicate ClickUp tasks. Imported rows store:

- `externalSource=CLICKUP`
- `externalId`
- `externalUrl`
- `syncedAt`
- `taskKey` when the title contains a valid key

Sync conflict strategy: the importer uses option B. It updates local editable fields only if the task was not changed locally after the last `syncedAt`. If a user edited a task locally, later imports refresh the external snapshot fields but do not silently overwrite the local working fields.

## Task list

1. Open the app at `http://localhost:5173`.
2. Select a task list in the left sidebar.
3. Confirm the browser calls `GET /api/tasks?...&limit=50`.
4. Search by title, description, or task key.
5. Filter by status, assignee, priority, or milestone.
6. Use `Load more` when `nextCursor` is returned.

The list is backed by PostgreSQL and does not load full task detail or activity records.

## Task detail and Activity

1. Open a task.
2. Edit title, description, status, priority, assignee, list, milestone, task key, dates, or tags.
3. Refresh the page and reopen the task.
4. Confirm the changes remain.
5. Open the Activity tab and confirm only real changed fields are logged.
6. Delete a task from the task menu. The project uses soft delete via `deletedAt`.

## Local task creation

1. Click `Add Task`.
2. Create a task with a title such as `CL-PROTO-099 Local test`.
3. Confirm it appears in the list with `externalSource=LOCAL`.
4. Re-run the ClickUp seed.
5. Confirm the local task is still present and was not overwritten.

## Reference data

The UI and filters use real data from these endpoints:

- `GET /api/departments?workspaceId=...`
- `GET /api/teams?workspaceId=...&departmentId=...`
- `GET /api/task-lists?workspaceId=...&teamId=...`
- `GET /api/milestones?workspaceId=...&teamId=...`
- `GET /api/task-statuses?workspaceId=...`

ClickUp seed upserts spaces, folders, lists, statuses, assignees, tags, and milestone records without duplicating them on repeat runs.

## Permissions

Manual checks:

1. Use `x-user-id: local-user` as OWNER. Read, create, edit, and delete should work.
2. Change a membership to `MEMBER`, assign a task to that user, and confirm that user can edit assigned/created tasks.
3. Confirm the same MEMBER cannot edit another user's task directly through `PATCH /api/tasks/:taskId`.
4. Confirm task CRUD works without any GitHub env variables.

## GitHub scope

New GitHub integration work is not part of this task. Existing GitHub code was left in place and made optional so it does not interfere with the core tracker. Do not use fake PR/status data in production flows.
