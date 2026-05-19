# Manual Verification: OpenProject Runtime

## Setup

1. Start OpenProject.
2. Create an OpenProject API token for the backend service user.
3. Fill `.env`:

```bash
OPENPROJECT_BASE_URL="http://localhost:8080"
OPENPROJECT_API_TOKEN="<your token>"
OPENPROJECT_TIMEOUT_MS=15000
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/compact_tracker?schema=public"
CLIENT_URL="http://localhost:5173"
PORT=4000
```

4. Start the tracker:

```bash
npm run setup
npm run dev
```

`CLICKUP_TOKEN` is not required. It is only for `npm run seed:openproject:clickup`.

## Connection

1. Open `http://localhost:5173`.
2. Confirm the first workspace call is `GET /api/openproject/workspaces`.
3. Confirm there are no production task runtime calls to `/api/clickup/*`.
4. If `OPENPROJECT_API_TOKEN` is missing or invalid, the UI should show a clear OpenProject error.

## Projects / Spaces

1. Confirm the sidebar shows real OpenProject projects as spaces.
2. Each project should have one system folder/list: `Work packages`.
3. Create Folder/Create List actions should not be active.
4. Project rename is disabled in the tracker and should be done in OpenProject settings.

## Task List

1. Select a project.
2. Confirm tasks load with `GET /api/openproject/tasks?listId=<projectId>&limit=50`.
3. Test status, assignee, priority, and search filters.
4. Use `Load more` if `nextCursor` exists.
5. Confirm empty/loading/error states are visible when applicable.

## Task Detail

1. Open a task.
2. Confirm detail loads through `GET /api/openproject/tasks/:taskId`.
3. Edit title, description, status, priority, dates, and assignee/responsible.
4. Refresh and confirm changes persist in OpenProject.
5. Unsupported fields such as tags, dependencies, attachments, and timers should not appear as active editable controls.

## Create / Update / Delete

1. Click `Add Task`.
2. Confirm `POST /api/openproject/tasks` creates an OpenProject work package.
3. Duplicate/delete from task actions and confirm OpenProject reflects the change.
4. Write actions should work only for local `OWNER`/`ADMIN` in service-token mode.

## Activity

1. Open a task.
2. Open Activity.
3. Confirm `GET /api/openproject/tasks/:taskId/activity` returns real OpenProject activities.
4. Comment composer is hidden until OpenProject comment writing is wired.

## Subtasks

1. Create a subtask from task detail if the control is available.
2. Confirm the child work package has the parent set in OpenProject.
3. If children are not embedded by OpenProject, this is a known limitation.

## Docs

Docs are currently Local Docs backed by this app, not OpenProject wiki pages. Do not treat them as OpenProject-backed until wiki page support is added.

## GitHub

GitHub is optional. Without GitHub env, the tracker should still load workspaces, task list, detail, CRUD, and activity. GitHub tabs/actions should not show fake data.

## Optional ClickUp Migration

`npm run seed:openproject:clickup` can migrate ClickUp data into OpenProject. This is one-time migration tooling, not runtime.

## Verify

```bash
npm test
npm run build
```

Unit tests mock network calls and should not require a real OpenProject instance unless a test is explicitly marked as integration.
