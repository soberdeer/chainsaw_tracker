# Compact OpenProject Tracker

Compact task tracker with a ClickUp-like React UI and OpenProject as the task runtime source of truth.

## Source Of Truth

OpenProject API is the source of truth for production task runtime data:

- Projects -> UI spaces
- Subprojects -> nested sidebar folders/projects
- Work packages -> tasks
- Statuses -> task columns/groups
- Types -> work package type for creation
- Priorities -> task priority
- Users -> assignee/responsible options
- Parent links -> subtasks
- Activities/comments -> task activity timeline and comment writing

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

Optional migration-only user env:

```bash
OPENPROJECT_IMPORTED_USER_PASSWORD="Clickup!2026"
OP_IMPORTED_ADMIN_EMAILS=""
CLICKUP_IMPORTED_USER_PASSWORD="clickup!2026"
```

`OPENPROJECT_IMPORTED_USER_PASSWORD` is the temporary password for real OpenProject users created from ClickUp users. Existing OpenProject users are reused and their passwords are not reset.

## Clean Re-import

Use the guarded reset script before a clean ClickUp re-import when OpenProject already contains stale test projects, duplicated work packages, or bad previous imports.

Dry-run only:

```bash
npm run reset:openproject -- --dry-run
```

Real destructive reset:

```bash
npm run reset:openproject -- --yes --confirm DELETE_ALL_OPENPROJECT_PROJECTS_AND_WORK_PACKAGES
```

If `NODE_ENV=production`, add:

```bash
--allow-production
```

The reset removes only OpenProject work packages and OpenProject projects. It does not delete:

- OpenProject users
- OpenProject roles
- OpenProject statuses
- OpenProject priorities
- OpenProject custom fields
- OpenProject workflows
- local Prisma users
- local auth/session data
- Local Docs
- GitHub repository settings

After reset, run the ClickUp migration again:

```bash
CLICKUP_TOKEN="..." npm run seed:openproject:clickup
```

The reset also removes stale local references to deleted OpenProject project/work package ids and deletes `server/openproject/seed-data/clickup-hierarchy.json` so the next seed rebuilds hierarchy from scratch.

## Mapping

The production runtime uses a stable OpenProject mapping:

- UI workspace: virtual `openproject` workspace for the configured OpenProject instance
- UI space: OpenProject project
- UI folder: OpenProject subproject, plus a system `Work packages` folder for each project
- UI list: the default `Work packages` view for the OpenProject project/subproject
- UI task: OpenProject work package

The optional ClickUp migration script can create OpenProject projects from ClickUp spaces/folders/lists, but the app does not need `server/openproject/seed-data/clickup-hierarchy.json` to run.

The remaining ClickUp helper files live under `scripts/migration/clickup`. They are migration-only helpers for that script. They are not mounted by `server/index.ts` and are not used by the frontend runtime.

## Permissions

The app currently uses a local session cookie plus one OpenProject service token. A default local owner is created on first login:

```text
email: owner@local.app
password: admin123
```

Set `DEV_ADMIN_PASSWORD` to override the development password.

To avoid letting every local demo user write through the service token, OpenProject write actions are restricted to local `OWNER` and `ADMIN` roles. `LEAD`, `MEMBER`, and `VIEWER` are read-only until per-user OpenProject auth is implemented.

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
- `POST /api/openproject/tasks/:taskId/activity`
- `GET /api/openproject/tasks/:taskId/relations`
- `POST /api/openproject/tasks/:taskId/relations`
- `DELETE /api/openproject/tasks/:taskId/relations/:relationId`
- `GET /api/openproject/tasks/:taskId/time-entries`
- `POST /api/openproject/tasks/:taskId/time-entries`
- `GET /api/openproject/tasks/:taskId/attachments`
- `POST /api/openproject/tasks/:taskId/attachments`
- `GET /api/openproject/tasks/:taskId/custom-fields`
- `PATCH /api/openproject/tasks/:taskId/custom-fields/:fieldKey`
- `POST /api/openproject/tasks/bulk-update`
- `GET /api/openproject/search?q=...`
- `GET/POST/PATCH/DELETE /api/saved-views`
- `GET/POST /api/notifications`
- `GET /api/import-reports`
- `GET /api/import-reports/:id`

Unsupported OpenProject adapter actions are disabled in the UI. Folder/list creation is not active because OpenProject has no direct folder/list equivalent in this mapping.

## Filters

Task list filters are sent to OpenProject API v3 as work package filters:

- status uses `status = <id>`
- assignee uses `assignee = <id>`
- priority uses `priority = <id>`
- search uses `subject ~ <text>`

Search is a subject/title contains filter, not a global full-text search across every work package field.

## Current Limitations

- Board view is available as a status board. Dragging a card between columns updates the OpenProject status.
- Reordering inside a status is not persisted because OpenProject is the source of truth and this adapter does not map order to a supported OpenProject field.
- Docs are still local docs, not OpenProject wiki pages. The UI should treat them as Local Docs.
- Relations/dependencies are OpenProject-backed from task detail. Supported relation types are relates, blocks, blocked by, follows, and precedes.
- Time entries are OpenProject-backed from task detail. The UI creates time entries against the first available OpenProject time entry activity.
- Attachments are OpenProject-backed from task detail when the OpenProject attachments endpoint is enabled for the token/project.
- Supported scalar custom fields are editable from task detail: text, multiline text, integer, float, date, and boolean. Unsupported or structured field types stay read-only.
- Tags are not editable yet. ClickUp tags should be migrated to a real OpenProject custom field or stored as documented metadata before exposing editing.
- Saved views are local tracker settings in Prisma and apply backend OpenProject filters.
- Bulk actions are OpenProject-backed partial updates for selected visible tasks.
- Notifications are local in-app notifications in Prisma for assignment/comment events generated by the tracker UI.
- Import reports are stored in Prisma `MigrationRun` records when the ClickUp migration seed runs, and the UI can open the latest report details or download the raw JSON.
- GitHub integration is optional and isolated from OpenProject task runtime.
- GitHub links are hidden for OpenProject-backed work packages until an explicit `OpenProject workPackageId -> local GitHub link taskId` mapping exists.

## Optional ClickUp Migration

`npm run seed:openproject:clickup` is a one-time migration helper. It can read ClickUp data and create/reuse OpenProject projects/work packages, OpenProject users, and project memberships. It is not part of runtime and should not be required to start the tracker.

The migration maps ClickUp access conservatively:

- `team.members` -> workspace-wide OpenProject project memberships.
- explicit list members -> membership on the mapped list project.
- task assignees -> at least Member access on the mapped list project.
- first ClickUp assignee -> OpenProject `assignee`.
- second ClickUp assignee -> OpenProject `responsible`.
- additional ClickUp assignees -> stored in the work package description metadata block until watcher mapping is implemented.
- known inherited grants are applied Space -> Folder -> List.
- private Space/Folder explicit access emits a warning if ClickUp does not return explicit members through the available API response.
