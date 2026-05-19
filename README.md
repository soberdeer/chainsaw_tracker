# Compact OpenProject Tracker

Compact task tracker with a ClickUp-like React UI and OpenProject as the task runtime source of truth.

## Source Of Truth

OpenProject API is the source of truth for production task runtime data:

- Projects -> UI spaces
- Work packages -> tasks
- Statuses -> task columns/groups
- Types -> work package type for creation
- Priorities -> task priority
- Users -> assignee/responsible options
- Parent links -> subtasks
- Activities -> task activity timeline

PostgreSQL/Prisma remains only for local scaffold features such as demo membership/permissions, optional GitHub storage, and local docs while docs are not migrated to OpenProject wiki pages.

## Env

Required runtime env:

```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/compact_tracker?schema=public"
PORT=4000
CLIENT_URL="http://localhost:5173"

OPENPROJECT_BASE_URL="http://localhost:8080"
OPENPROJECT_API_TOKEN="opapi_..."
OPENPROJECT_TIMEOUT_MS=15000
OPENPROJECT_AUTH_MODE="basic"
```

Optional:

```bash
GITHUB_INTEGRATION_ENABLED="false"
GITHUB_WEBHOOK_SECRET=""
GITHUB_TOKEN=""
```

`OPENPROJECT_API_TOKEN` is used only by the backend. It is never sent to the frontend.

`CLICKUP_TOKEN` is not required for runtime. It is used only by the optional one-time migration script:

```bash
npm run seed:openproject:clickup
```

## Mapping

The production runtime uses a stable OpenProject mapping:

- UI workspace: virtual `openproject` workspace for the configured OpenProject instance
- UI space: OpenProject project
- UI folder: one system folder named `Work packages`
- UI list: one system list named after the OpenProject project
- UI task: OpenProject work package

The optional ClickUp migration script can create OpenProject projects from ClickUp spaces/folders/lists, but the app does not need `server/openproject/seed-data/clickup-hierarchy.json` to run.

The remaining ClickUp helper files live under `scripts/migration/clickup`. They are migration-only helpers for that script. They are not mounted by `server/index.ts` and are not used by the frontend runtime.

## Permissions

The app currently uses one OpenProject service token. To avoid letting every local demo user write through that token, write actions are restricted to local `OWNER` and `ADMIN` roles. `LEAD`, `MEMBER`, and `VIEWER` are read-only until per-user OpenProject auth is implemented.

## Run

```bash
npm install
npm run setup
npm run dev
```

Frontend: `http://localhost:5173`  
API: `http://localhost:4000`

## Runtime Routes

Frontend task runtime uses `/api/openproject/*`:

- `GET /api/openproject/workspaces`
- `GET /api/openproject/projects`
- `GET /api/openproject/task-lists`
- `GET /api/openproject/task-statuses`
- `GET /api/openproject/tasks?listId=<projectId>&limit=50`
- `POST /api/openproject/tasks`
- `GET /api/openproject/tasks/:taskId`
- `PATCH /api/openproject/tasks/:taskId`
- `DELETE /api/openproject/tasks/:taskId`
- `POST /api/openproject/tasks/:taskId/duplicate`
- `GET /api/openproject/tasks/:taskId/activity`
- `GET /api/openproject/search?q=...`

Unsupported OpenProject adapter actions are disabled in the UI. Folder/list creation is not active because OpenProject has no direct folder/list equivalent in this mapping.

## Filters

Task list filters are sent to OpenProject API v3 as work package filters:

- status uses `status = <id>`
- assignee uses `assignee = <id>`
- priority uses `priority = <id>`
- search uses `subject ~ <text>`

Search is a subject/title contains filter, not a global full-text search across every work package field.

## Current Limitations

- Board view and drag reorder are disabled for MVP. List view is the production task view.
- Reordering inside a status is not saved locally because OpenProject is the source of truth and this adapter does not map order to a supported OpenProject field.
- Docs are still local docs, not OpenProject wiki pages. The UI should treat them as Local Docs.
- Tags, attachments, dependencies, time entries, and custom fields are hidden or read-only unless wired to OpenProject.
- GitHub integration is optional and isolated from OpenProject task runtime.
- GitHub links are hidden for OpenProject-backed work packages until an explicit `OpenProject workPackageId -> local GitHub link taskId` mapping exists.

## Optional ClickUp Migration

`npm run seed:openproject:clickup` is a one-time migration helper. It can read ClickUp data and create/reuse OpenProject projects/work packages. It is not part of runtime and should not be required to start the tracker.
