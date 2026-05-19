# Manual Verification: OpenProject-backed Tracker

This tracker uses OpenProject API as the runtime source of truth for projects, work packages, statuses, priorities, assignees, dates, subtasks, and activity.

PostgreSQL is still used for local scaffolding such as demo membership, Local Docs, and optional existing GitHub storage. ClickUp is not a runtime backend.

## Required Environment

```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/compact_tracker?schema=public"
PORT=4000
CLIENT_URL="http://localhost:5173"

OPENPROJECT_BASE_URL="http://localhost:8080"
OPENPROJECT_API_TOKEN="<openproject api token>"
OPENPROJECT_TIMEOUT_MS=15000
OPENPROJECT_AUTH_MODE="basic"
```

`OPENPROJECT_AUTH_MODE="basic"` sends `Authorization: Basic base64(apikey:token)`.
`OPENPROJECT_AUTH_MODE="bearer"` sends `Authorization: Bearer token`.

`CLICKUP_TOKEN` is not required for runtime. It is only used by the optional one-time migration script `npm run seed:openproject:clickup`.

## Start OpenProject

1. Start your OpenProject instance.
2. Open OpenProject in the browser, for example `http://localhost:8080`.
3. Create or choose the service user that the tracker backend will use.
4. Create an API token for that user in OpenProject account settings.
5. Put the token in `.env` as `OPENPROJECT_API_TOKEN`.

The tracker backend never sends `OPENPROJECT_API_TOKEN` to the frontend.

## Start Tracker

```bash
npm install
npm run setup
npm run dev
```

If `OPENPROJECT_API_TOKEN` is missing or invalid, OpenProject-backed endpoints should return a clear JSON error instead of an empty fake workspace.

## Connection Check

1. Open `http://localhost:5173`.
2. Check `GET /api/openproject/workspaces`.
3. Expected: a workspace response containing real OpenProject projects as spaces.
4. Confirm there are no production task runtime calls to legacy ClickUp endpoints.

Optional direct check:

```bash
curl http://localhost:4000/api/openproject/workspaces
```

## Projects / Spaces

1. Confirm sidebar spaces are real OpenProject projects.
2. Confirm each project exposes the system list/view for work packages.
3. Confirm project rename is disabled in the tracker and points users to OpenProject settings.
4. Confirm Create Folder and Create List are hidden or disabled.
5. In DevTools Network, these normal UI actions must not call:
   - `PATCH /api/openproject/spaces/:spaceId`
   - `POST /api/openproject/spaces/:spaceId/folders`
   - `POST /api/openproject/folders/:folderId/lists`
6. Disabled menu items must not be clickable and must not send API requests.

## Task List

1. Select a project/space.
2. Confirm tasks load through `GET /api/openproject/tasks`.
3. Confirm the request includes `listId` or another OpenProject adapter id and a finite `limit`.
4. Test status, assignee, priority, and search filters.
5. Confirm filters are sent to the backend and OpenProject filter builder, not applied only to mock data.
6. OpenProject-backed filters use API v3 work package filters:
   - status: `{ "status": { "operator": "=", "values": ["<id>"] } }`
   - assignee: `{ "assignee": { "operator": "=", "values": ["<id>"] } }`
   - priority: `{ "priority": { "operator": "=", "values": ["<id>"] } }`
   - search: `{ "subject": { "operator": "~", "values": ["text"] } }`
7. Search is subject/title contains search, not a global full-text search across every field.
8. Use Load more if `nextCursor` exists.
9. Confirm loading, empty, and error states render honestly.

## Task Detail

1. Open a task from the list.
2. Confirm detail loads through `GET /api/openproject/tasks/:taskId`.
3. Confirm the OpenProject URL opens the real work package.
4. Edit and save:
   - title / subject
   - description
   - status
   - assignee / responsible
   - priority
   - start date
   - due date
5. Refresh the page and confirm changes persisted in OpenProject.
6. Unsupported fields such as tags, dependencies, attachments, custom fields, and timers must not appear as active editable controls.

## Create / Update / Delete

1. Click Add Task.
2. Confirm the modal only creates a Task work package. It must not show active Doc, Reminder, Whiteboard, or Dashboard tabs.
3. Create a task and confirm `POST /api/openproject/tasks`.
4. Open the new task in OpenProject and confirm it exists.
5. Update task fields and confirm `PATCH /api/openproject/tasks/:taskId`.
6. Delete or duplicate through task actions if available and confirm the result in OpenProject.

In service-token mode, write actions are restricted to local `OWNER` and `ADMIN` roles. `LEAD` and `MEMBER` are read-only for OpenProject writes until per-user OpenProject auth exists.

## Status / Assignee / Priority / Dates

1. Change status and refresh.
2. Change assignee/responsible and refresh.
3. Change priority and refresh.
4. Change start/due dates and refresh.
5. Confirm every changed value is visible in OpenProject, not only in local UI state.

## Subtasks

1. Open task detail.
2. Create a subtask if the Add subtask action is available.
3. Confirm `POST /api/openproject/tasks` sends the parent work package link.
4. Refresh and confirm the child remains under the parent.
5. Open the subtask as a normal work package.

## Activity / Comments

Activity is OpenProject-backed and read-only in this MVP.

1. Open task detail.
2. Open Activity.
3. Confirm `GET /api/openproject/tasks/:taskId/activity`.
4. Confirm real OpenProject activity entries are shown.
5. Confirm there is no fake comment composer. Comment writing is unsupported until wired to OpenProject addComment.

## Local Docs Limitation

Docs are currently Local Docs backed by this app, not OpenProject Wiki.

1. The UI must label docs as Local Docs.
2. Creating or editing docs should persist in the local app storage.
3. Do not treat docs as OpenProject-backed until wiki support is implemented.

## GitHub Optional Behavior

Existing GitHub code is optional and isolated.

1. Start the tracker with no GitHub env values.
2. Confirm workspaces, task list, task detail, CRUD, subtasks, and activity still work.
3. For OpenProject-backed tasks, GitHub tab/actions are hidden because the old GitHub links use local Prisma task ids, while OpenProject tasks use work package ids.
4. No fake GitHub data should be shown.

## Unsupported Features

Currently unsupported or disabled:

- OpenProject Wiki-backed docs.
- Comment creation from the tracker UI.
- Attachments upload.
- Time entries/timer actions.
- Dependencies/relations UI.
- Custom fields editing.
- Tags editing.
- Folder/List creation inside the ClickUp-like hierarchy.
- Board reorder/order persistence.
- GitHub links for OpenProject-backed work packages until an explicit mapping exists.

Unsupported features should be hidden or disabled with clear copy. They should not appear as active buttons.

## Optional ClickUp Migration

`npm run seed:openproject:clickup` is a one-time migration helper. It can read ClickUp data and create/reuse OpenProject projects/work packages.

This script may use `CLICKUP_TOKEN`, but the tracker runtime does not.

## Final Verification

```bash
npm test
npm run build
```

Unit tests mock network calls and do not require a real OpenProject instance unless a test is explicitly marked as integration.
