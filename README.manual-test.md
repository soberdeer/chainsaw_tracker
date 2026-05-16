# Manual verification

## Local setup

1. Copy `.env.example` to `.env`.
2. Set `CLICKUP_TOKEN` to a ClickUp personal API token. This is required for the task tracker runtime.
3. Start PostgreSQL if you use local docs, auth, permissions, or the existing GitHub storage:
   `npm run db:up`
4. Apply migrations and generate Prisma Client:
   `npx prisma migrate deploy && npm run prisma:generate`
5. Start the app:
   `npm run dev`

Required env for the ClickUp-backed task tracker:

- `CLICKUP_TOKEN`
- `PORT`
- `CLIENT_URL`

`DATABASE_URL` is still needed for the existing local app features that were not migrated in this task, including auth-like membership data, documents, and existing GitHub storage. PostgreSQL is not the source of truth for ClickUp task/list/status/assignee data in the production task flow.

On server start the app bootstraps a tiny local permission workspace for `local-user`. This does not import or cache ClickUp tasks; it only gives the demo user permission to call ClickUp write adapter endpoints.

Optional env:

- `CLICKUP_TIMEOUT_MS`
- `GITHUB_INTEGRATION_ENABLED=true`
- `GITHUB_WEBHOOK_SECRET`
- `GITHUB_TOKEN`
- future placeholders: `GITHUB_APP_ID`, `GITHUB_PRIVATE_KEY`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`

GitHub env is not required for task list, task detail, create, update, delete, or ClickUp hierarchy loading.

## ClickUp API runtime

The production task tracker now calls backend adapter routes under `/api/clickup/*`. The backend uses:

`Authorization: process.env.CLICKUP_TOKEN`

The token is never sent to the frontend. Do not use the ClickUp OAuth token endpoint for this personal token flow.

Adapter routes added:

- `GET /api/clickup/team`
- `GET /api/clickup/workspaces`
- `GET /api/clickup/spaces?workspaceId=...`
- `POST /api/clickup/spaces`
- `PATCH /api/clickup/spaces/:spaceId`
- `POST /api/clickup/spaces/:spaceId/folders`
- `POST /api/clickup/folders/:folderId/lists`
- `GET /api/clickup/task-lists?workspaceId=...`
- `GET /api/clickup/task-statuses?workspaceId=...`
- `GET /api/clickup/tasks?listId=...&limit=50`
- `POST /api/clickup/tasks`
- `GET /api/clickup/tasks/:taskId`
- `PATCH /api/clickup/tasks/:taskId`
- `DELETE /api/clickup/tasks/:taskId`
- `POST /api/clickup/tasks/:taskId/duplicate`
- `GET /api/clickup/tasks/:taskId/activity`
- `GET /api/clickup/search?q=...&workspaceId=...`

Old Prisma task routes still exist in the repository for non-migrated internal code and historical compatibility, but they are not mounted by `server/index.ts` for production task routing. The production task UI is wired to `/api/clickup/*`.

## Verify ClickUp hierarchy

1. Open `http://localhost:5173`.
2. Confirm the sidebar shows real ClickUp Workspaces, Spaces, Folders, and Lists.
3. In DevTools, confirm the initial task tracker call is `GET /api/clickup/workspaces`.
4. Confirm there are no production task tracker calls to `/api/workspaces`, `/api/tasks`, `/api/task-statuses`, or `/api/search`.

If `CLICKUP_TOKEN` is missing, the UI should show a clear "Could not load ClickUp workspace" error instead of an empty fake workspace.

## Verify task list

1. Select a real ClickUp List.
2. Confirm tasks are loaded with `GET /api/clickup/tasks?listId=...&limit=50`.
3. Use search. Search is applied by the backend adapter over the current ClickUp page.
4. Filter by status, assignee, or priority.
5. Use `Load more` when `nextCursor` is returned. Cursor maps to the ClickUp page number.

The list shows real ClickUp tasks only. It does not read task rows from PostgreSQL.

## Verify task detail

1. Open a task.
2. Confirm detail calls `GET /api/clickup/tasks/:taskId`.
3. Edit title, description, status, assignee, priority, start date, or due date.
4. Refresh the page and reopen the task.
5. Confirm the change remains in ClickUp.
6. Use `Open in ClickUp` to confirm the source task URL.

Task key, tags, list, and dependency information are shown read-only unless ClickUp returns data that this adapter can safely update.

## Verify create/update/delete

1. Click `Add Task`.
2. Confirm `POST /api/clickup/tasks` creates the task in the selected ClickUp List.
3. Rename from the task action menu and confirm `PATCH /api/clickup/tasks/:taskId`.
4. Duplicate from the task action menu and confirm a copied task appears in ClickUp.
5. Delete from the task action menu and confirm `DELETE /api/clickup/tasks/:taskId`.

All persistence should survive browser refresh because ClickUp is the source of truth.

Write routes are guarded on the backend by app-local membership checks. `OWNER` and `ADMIN` can change ClickUp hierarchy; `OWNER`, `ADMIN`, `LEAD`, and `MEMBER` can write tasks.

## Unsupported features

Intentionally unsupported in this migration:

- ClickUp Chats
- ClickUp Guests
- Guest sharing
- Fake chat messages
- Fake guest data

Dependencies, list moves, custom field edits, attachment upload, timers, and tag mutation were not expanded in this pass. UI that previously looked editable for unsupported fields was removed or made read-only.

## Existing GitHub integration

Existing GitHub code was not removed and no new GitHub functionality was added. GitHub remains optional and isolated from the ClickUp task runtime. The task tracker works without GitHub env/config.

## Tests

Run:

`npm test`

The ClickUp unit tests mock `fetch` and do not require a real `CLICKUP_TOKEN`.

Run:

`npm run build`

The build should pass. Vite may warn about chunk size; that warning is not a build failure.
