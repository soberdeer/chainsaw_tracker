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

PostgreSQL/Prisma remains only for local extension layers such as auth and sessions, workspace roles, saved views, notifications, local docs, import reports, GitHub bindings, board order, and OpenProject tag metadata while docs are not migrated to OpenProject wiki pages.

## User Model

The app now keeps two related user layers:

- Local tracker user in Prisma:
  - login/session
  - workspace role
  - local profile fields
  - saved views
  - notifications
  - import reports access
- OpenProject user:
  - project memberships
  - assignee / responsible on work packages
  - OpenProject comments, files, time entries, workflow permissions

Imported ClickUp users are created or reused in both places when possible. The local Prisma user stores the link to the matching OpenProject user through `openProjectUserId` and `openProjectLogin`.

## Getting Started

If you just cloned the project and want to run the tracker locally, use this order:

### 1. Install prerequisites

Required:

- Node.js 22+
- npm 10+
- Docker Desktop or a local PostgreSQL instance
- an OpenProject instance with an API token for runtime use

You only need a live OpenProject instance for the real app runtime. The Playwright e2e suite uses its own mock layer and does not require OpenProject.

### 2. Install dependencies

```bash
npm install
```

### 3. Create your local env file

Copy the example env and fill in the OpenProject values:

```bash
cp .env.example .env
```

Minimum required runtime values in `.env`:

```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/compact_tracker?schema=public"
PORT=4000
CLIENT_URL="http://localhost:5173"

OPENPROJECT_BASE_URL="http://localhost:8080"
OPENPROJECT_API_TOKEN="opapi_..."
OPENPROJECT_TIMEOUT_MS=15000
OPENPROJECT_AUTH_MODE="basic"
```

If you do not have GitHub integration yet, leave these disabled or empty:

```bash
GITHUB_INTEGRATION_ENABLED="false"
GITHUB_WEBHOOK_SECRET=""
GITHUB_TOKEN=""
```

### 4. Start PostgreSQL

The project ships with a Docker Compose Postgres service in [docker-compose.yml](/Users/telsehush/Documents/Codex/2026-05-11/tracker/docker-compose.yml). For most people, this is the easiest way to get the local database running.

If you use Colima on macOS:

```bash
colima start
```

If you use Docker Desktop instead:

- start Docker Desktop
- wait until `docker ps` works

Before starting Postgres, you can run the built-in Docker health check:

```bash
npm run docker:check
```

That command tries to reach the Docker daemon and prints a more helpful message if:

- Docker is not installed
- Docker Desktop is not running
- your shell is pointed at a stopped Colima socket

Then start Postgres:

```bash
npm run db:up
```

Useful Docker helpers:

```bash
npm run db:ps
npm run db:logs
npm run db:down
```

If you already run PostgreSQL locally and do not want Docker for the database, make sure the database from `DATABASE_URL` exists and skip `npm run db:up`.

### 5. Create the local database and run Prisma setup

For a local PostgreSQL server:

```bash
npm run setup:local
```

That runs:

- database creation if needed
- Prisma migrations
- Prisma client generation

If you already have Postgres running through Docker and just want to sync the schema/client, use:

```bash
npm run db:sync
```

If you use the bundled Docker Postgres and want the one-command setup path:

```bash
npm run setup
```

### 6. Start the app

```bash
npm run dev
```

This starts:

- frontend on `http://localhost:5173`
- backend on `http://localhost:4000`

### 7. Complete first-run setup

Open [http://localhost:5173](http://localhost:5173).

On a fresh database the app shows the first-run setup screen instead of a default admin account. Create the first local owner there.

Important:

- production-style default credentials are **not** created automatically
- the old development owner shortcut exists only if you explicitly set:

```bash
DEV_DEFAULT_OWNER_ENABLED=true
```

When that flag is enabled, the development login is:

```text
email: owner@local.app
password: admin123
```

You can override the development password with `DEV_ADMIN_PASSWORD`.

### 8. After pulling new changes

If you pulled the latest branch or switched to another branch, always resync Prisma before starting the app again:

```bash
npm run db:sync
```

Why this matters:

- this project adds Prisma migrations over time
- backend code can start using new tables immediately
- if your local database is behind, you can get runtime errors like:

```text
The table `public.OpenProjectBoardCardOrder` does not exist in the current database.
```

That error does **not** usually mean the code is broken. It usually means your local database has not applied the latest migration yet.

### 9. Sanity-check the install

Useful local checks:

```bash
npm run format:check
npm run lint
npm run typecheck
npm run test
npm run build
```

### 10. Run the Playwright suite

The e2e suite runs against a deterministic mock API and does not require your real OpenProject instance:

```bash
npm run e2e
```

Useful variants:

```bash
npm run e2e:ui
npm run e2e:headed
npm run e2e:debug
```

### 11. Optional one-time ClickUp import

If you want to seed OpenProject from ClickUp after the runtime is already working:

```bash
CLICKUP_TOKEN="..." npm run seed:openproject:clickup
```

This is migration-only tooling. It is not required to boot the tracker.

## Troubleshooting

### `OpenProjectBoardCardOrder does not exist`

Your local database is behind the current Prisma schema.

Run:

```bash
npm run db:sync
```

If that still fails because the database itself is missing, start Postgres first:

```bash
npm run db:up
npm run db:sync
```

### Docker / Colima socket error

If you see an error like:

```text
failed to connect to the docker API at unix:///Users/.../.colima/default/docker.sock
```

then your shell is pointed at Colima, but Colima is not running yet.

Start it:

```bash
colima start
npm run docker:check
npm run db:up
```

If you use Docker Desktop instead of Colima:

```bash
docker context use default
npm run docker:check
```

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

The app currently uses a local session cookie plus one OpenProject service token.

On first run, the app requires creating the first local owner through the setup screen. No production-ready default password is created automatically.

For local development only, you can still opt into a seeded owner account by setting:

```text
DEV_DEFAULT_OWNER_ENABLED=true
```

When that flag is enabled, the development owner credentials are:

```text
email: owner@local.app
password: admin123
```

Set `DEV_ADMIN_PASSWORD` to override the development password.

To avoid letting every local user write through the service token, OpenProject write actions are still checked against local runtime permissions on the backend:

- `OWNER` and `ADMIN` manage workspace settings, users, OpenProject project actions, imports, and task writes
- `LEAD` can create and edit tasks, move statuses, comment, attach files, and manage saved views
- `MEMBER` can create and edit accessible tasks, change statuses, comment, and log time
- `VIEWER` stays read-only

Workspace-level admin actions such as member management and OpenProject project changes remain restricted even though task writes are allowed for `LEAD` and `MEMBER`.

## Workspace Settings And Account UI

The tracker includes:

- Workspace overview and onboarding panel after login:
  - OpenProject connection status
  - latest import status
  - warnings and errors count from the latest import report
  - import coverage summary for projects, tasks, users, memberships, and assignee mapping
  - quick actions for all tasks, assigned work, imports, settings, and OpenProject
- Workspace settings:
  - General
  - Members
  - Roles & Permissions
  - OpenProject connection
  - Imports
  - Danger Zone guidance
- User account:
  - Profile
  - Security
  - My work
  - Access
- Action feedback:
  - transient toast notifications for save, invite, password, task, relation, attachment, and bulk actions
  - inline warning/error banners for longer OpenProject or import issues

Task detail opens in a right-side drawer so list and board context stay visible. Breadcrumbs show the current workspace, space, folder, list, and the open task or local doc.

The main task runtime now has three practical scopes:

- `All Tasks`: cross-project OpenProject work packages across the runtime workspace
- `My Tasks`: cross-project work packages assigned to the linked OpenProject user
- project/subproject `Work packages`: OpenProject-native scoped list and board views

The UI explains the difference between:

- Local tracker role:
  controls access to the custom tracker UI and local app features
- OpenProject membership:
  controls access to OpenProject projects and work packages

## Run

```bash
npm install
npm run setup
npm run dev
```

Frontend: `http://localhost:5173`  
API: `http://localhost:4000`

## Testing

Fast local checks:

```bash
npm run format:check
npm run lint
npm run typecheck
npm run test
npm run build
```

Playwright end-to-end coverage runs separately:

```bash
npm run e2e
```

Useful variants:

```bash
npm run e2e:ui
npm run e2e:headed
npm run e2e:debug
```

The Playwright suite runs the Vite app and API against a deterministic mock layer. It does not need
a live OpenProject or GitHub instance. The mock API keeps real state transitions for:

- first-run setup and login
- OpenProject task list/detail/create/update flows
- comments, relations, attachments, time entries, and activity
- workspace-scoped OpenProject tag metadata
- saved views, notifications, local docs, and import reports
- board order persistence
- GitHub PR link state and webhook-driven notification events

When you update the mocked runtime behavior, keep `tests/e2e/support/mockApi.ts` in sync with the
corresponding server/UI contract and extend the matching spec under `tests/e2e/`.

## Runtime Routes

Frontend task runtime uses `/api/openproject/*`:

- `GET /api/openproject/workspaces`
- `GET /api/openproject/projects`
- `GET /api/openproject/task-lists`
- `GET /api/openproject/task-statuses`
- `GET /api/openproject/task-types`
- `GET/POST/PATCH/DELETE /api/openproject/tags`
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
- `GET /api/openproject/time-entry-activities`
- `GET /api/openproject/tasks/:taskId/tags`
- `PUT /api/openproject/tasks/:taskId/tags`
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
- responsible uses `responsible = <id>`
- type uses `type = <id>`
- priority uses `priority = <id>`
- search uses `subject ~ <text>`
- due by / overdue / updated since / tags / has GitHub PR are applied by the tracker after OpenProject pages are loaded

Tags for OpenProject-backed work packages are stored as local metadata keyed by `workPackageId`. This keeps OpenProject as the source of truth for the work package itself while allowing workspace-level tags, tag filters, and tag badges without creating local task duplicates.

When a local-only filter is active, the tracker scans OpenProject pages progressively until it fills the requested page size, reaches the end of the OpenProject result set, or hits the safe scan limit controlled by `OPENPROJECT_LOCAL_FILTER_MAX_SCAN` (default `1000` scanned work packages per request). If more potential matches remain, the backend returns `nextCursor` so the UI can continue scanning with `Load more`.

Search is a subject/title contains filter, not a global full-text search across every work package field.

## Current Limitations

- Board view is available as a status board. Dragging a card between columns updates the OpenProject status, and the manual order inside each column is stored locally per concrete OpenProject list/view. Aggregate `All Tasks` and `My Tasks` boards reuse statuses but do not persist a shared manual order.
- Space / folder / list navigation stays OpenProject-native. The tracker does not create ClickUp-style folders or lists because OpenProject has no direct equivalent in this adapter.
- Docs are still local docs, not OpenProject wiki pages. The UI should treat them as Local Docs.
- Relations/dependencies are OpenProject-backed from task detail. Supported relation types are relates, blocks, blocked by, follows, and precedes.
- Time entries are OpenProject-backed from task detail. The UI loads OpenProject time entry activities and lets the user choose one before saving.
- Attachments are OpenProject-backed from task detail when the OpenProject attachments endpoint is enabled for the token/project.
- Supported scalar custom fields are editable from task detail: text, multiline text, integer, float, date, and boolean. Unsupported or structured field types stay read-only.
- Tags are editable for OpenProject-backed work packages through local metadata keyed by `workPackageId`. They are visible in task detail, grouped list rows, board cards, and tag filters.
- Saved views are local tracker settings in Prisma and apply backend OpenProject filters.
- `All Tasks` and `My Tasks` use workspace-wide OpenProject work package queries without a project id. Project and subproject `Work packages` views stay scoped to the selected OpenProject path.
- Bulk actions are OpenProject-backed partial updates for selected visible tasks.
- Notifications are local in-app notifications in Prisma for assignment/comment events generated by the tracker UI.
- Import reports are stored in Prisma `MigrationRun` records when the ClickUp migration seed runs, and the UI can open the latest report details or download the raw JSON.
- GitHub integration is optional and isolated from task runtime. OpenProject-backed work packages can link synced pull requests by `workPackageId`, webhook and sync autolinking use the extracted tracker task key when possible, and PR review state is visible in task detail, list rows, and board cards.
- GitHub PR events for OpenProject-backed work packages currently create local in-app notifications for linked assignee and responsible users. They do not write into the OpenProject activity timeline yet.
- Commit-by-commit activity, full checks rollups on every card, and status automation remain future work.

## Optional ClickUp Migration

`npm run seed:openproject:clickup` is a one-time migration helper. It can read ClickUp data and create/reuse OpenProject projects/work packages, OpenProject users, and project memberships. It is not part of runtime and should not be required to start the tracker.

The migration maps ClickUp access conservatively:

- `team.members` -> workspace-wide OpenProject project memberships.
- explicit list members -> membership on the mapped list project.
- task assignees -> at least Member access on the mapped list project.
- first ClickUp assignee -> OpenProject `assignee`.
- second ClickUp assignee -> OpenProject `responsible`.
- additional ClickUp assignees -> stored in the work package description metadata block until watcher mapping is implemented.
- imported ClickUp users are linked back to the local tracker user so they can log in to the tracker UI.
- known inherited grants are applied Space -> Folder -> List.
- private Space/Folder explicit access emits a warning if ClickUp does not return explicit members through the available API response.
