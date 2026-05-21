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

## Login / Session

1. Open `http://localhost:5173`.
2. Log in with the development owner account:

   ```text
   email: owner@local.app
   password: admin123
   ```

3. If `DEV_ADMIN_PASSWORD` is set, use that password instead.
4. Confirm the sidebar shows the current local user.
5. Open the profile modal from the sidebar.
6. Change display name or avatar URL.
7. Refresh and confirm the local profile stays changed.
8. Open `Security` and change the password.
9. Log out and confirm the old password no longer works.
10. Log in again with the new password.
11. Log out and confirm protected tracker UI is no longer available.
12. Confirm the workspace overview shows connection status, latest import status, import coverage, and quick actions.

Important: if a user display name is empty, the tracker should keep it empty instead of replacing it with email or fallback copy in the profile/account editor.

## Workspace Settings

1. Open `Workspace settings` from the workspace header.
2. In `General`, rename the workspace and refresh.
3. Confirm the new workspace name persists.
4. In `Members`, invite a user by email with a local role.
5. Optionally enable `Create linked OpenProject user`.
6. Confirm the response shows a temporary password once for the new account.
7. Change the invited user role.
8. Confirm you cannot remove or downgrade the last `OWNER`.
9. Open `Roles & Permissions` and confirm it explains local tracker roles versus OpenProject memberships.
10. Open `OpenProject` and confirm the connection status loads without exposing the token.
11. Open `Imports` and confirm recent migration runs appear when they exist.
12. Open `Danger Zone` as owner and confirm destructive reset is described as a guarded CLI-only action in this MVP.

## Space / Project Access

1. Open a space menu in the sidebar.
2. Click `OpenProject access`.
3. Confirm the modal shows real OpenProject project memberships.
4. Confirm linked local users are shown when `openProjectUserId` exists.
5. Confirm the modal links to OpenProject settings instead of showing fake invite/edit controls.

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
2. Confirm top-level OpenProject projects appear as spaces.
3. Confirm OpenProject subprojects appear nested under their parent space/project.
4. Expand and collapse spaces and nested projects with the caret.
5. Confirm each project/subproject exposes a `Work packages` list.
6. Confirm project rename is disabled in the tracker and points users to OpenProject settings.
7. Confirm Create Folder and Create List are hidden or disabled.
8. Create a new space/project from the modal, not a browser prompt.
9. If OpenProject accepts the payload, confirm the new project appears in the sidebar tree.
10. In DevTools Network, these normal UI actions must not call:
   - `PATCH /api/openproject/spaces/:spaceId`
   - `POST /api/openproject/spaces/:spaceId/folders`
   - `POST /api/openproject/folders/:folderId/lists`
11. Disabled menu items must not be clickable and must not send API requests.

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
10. Confirm filters persist in the URL after refresh.
11. Save a view with `Private` or `Workspace` visibility and confirm it remains selectable after refresh.
12. Rename or delete a saved view from the saved view actions menu.

## Board View

1. Open the Board tab.
2. Confirm columns are real OpenProject statuses.
3. Drag a card from one status column to another.
4. Confirm the app sends `PATCH /api/openproject/tasks/:taskId`.
5. Refresh and confirm the new status remains in OpenProject.
6. Do not expect manual ordering inside a column to persist. The board only persists status changes.
7. If OpenProject rejects a status move by workflow, confirm the card returns to the previous column and the UI shows a clear error.

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
6. Open `Relations`, `Time`, and `Files` tabs and confirm they load real OpenProject-backed data.
7. Open `Custom fields` if present.
8. Confirm scalar fields such as text, multiline text, integer, float, date, and boolean can be edited.
9. Confirm unsupported custom field shapes remain read-only.
10. Confirm task detail opens in a right-side drawer and the list or board stays visible behind it.
11. Press `Esc` and confirm the drawer closes.
12. Confirm breadcrumbs match the selected workspace / space / folder / list / task path.

## Create / Update / Delete

1. Click Add Task.
2. Confirm the modal only creates a Task work package. It must not show active Doc, Reminder, Whiteboard, or Dashboard tabs.
3. Select status, assignee/responsible, priority, start date, and due date when needed.
4. Create a task and confirm `POST /api/openproject/tasks`.
5. Open the new task in OpenProject and confirm it exists.
6. Update task fields and confirm `PATCH /api/openproject/tasks/:taskId`.
7. Delete or duplicate through task actions if available and confirm the result in OpenProject.

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

Activity and comments are OpenProject-backed.

1. Open task detail.
2. Open Activity.
3. Confirm `GET /api/openproject/tasks/:taskId/activity`.
4. Confirm real OpenProject activity entries are shown.
5. As an owner/admin, add a comment.
6. Confirm `POST /api/openproject/tasks/:taskId/activity`.
7. Refresh and confirm the comment remains visible in OpenProject activity.
8. As a read-only user, confirm the comment composer is hidden or disabled.

## Local Docs Limitation

Docs are currently Local Docs backed by this app, not OpenProject Wiki.

1. The UI must label docs as Local Docs.
2. Open the `Local Docs` tab for a space that has docs.
3. Creating or editing docs should persist in the local app storage.
4. Do not treat docs as OpenProject-backed until wiki support is implemented.

## GitHub Optional Behavior

Existing GitHub code is optional and isolated.

1. Start the tracker with no GitHub env values.
2. Confirm workspaces, task list, task detail, CRUD, subtasks, and activity still work.
3. For OpenProject-backed tasks, GitHub tab/actions are hidden because the old GitHub links use local Prisma task ids, while OpenProject tasks use work package ids.
4. No fake GitHub data should be shown.

## Unsupported Features

Currently unsupported or disabled:

- OpenProject Wiki-backed docs.
- Tags editing.
- Folder/List creation inside the ClickUp-like hierarchy.
- Board card order persistence inside a status column.
- GitHub links for OpenProject-backed work packages until an explicit mapping exists.

Unsupported features should be hidden or disabled with clear copy. They should not appear as active buttons.

## Verify Relations, Time, Attachments, And Custom Fields

1. Open a task detail page.
2. Open the `Relations` tab.
3. Add a relation to another OpenProject work package id.
4. Refresh and confirm the relation remains visible.
5. Open the `Time` tab.
6. Log a time entry with hours, date, and comment.
7. Refresh and confirm the time entry remains visible.
8. Open the `Files` tab.
9. Upload a small attachment.
10. Refresh and confirm the attachment remains visible and can be opened.
11. If upload fails, verify the error comes from OpenProject permissions/API and not from fake UI.
12. If the task has OpenProject custom fields, edit a supported scalar field and blur the input.
13. Confirm OpenProject accepts the PATCH or returns a validation error in the UI.

## Verify Assigned To Me

1. Log in as a local tracker user whose email matches an imported OpenProject user.
2. Open a task list.
3. Click `Assigned to me`.
4. Confirm the assignee filter is set to the matching OpenProject user.
5. Confirm the task query is sent backend-side to `/api/openproject/tasks`.

You can also verify the same link from the profile modal:

1. Open `My work`.
2. Confirm the assigned summary loads when the local account is linked to an OpenProject user.
3. Click `Open Assigned to me`.
4. Confirm it reuses the existing assignee filter rather than opening a separate fake module.

## Verify Saved Views, Bulk Actions, Notifications, Import Reports

1. Set filters in the task list.
2. Enter a view name and click `Save view`.
3. Refresh and confirm the saved view is still in the Saved views select.
4. Select tasks with the row checkboxes.
5. Use bulk status/priority/assignee controls.
6. Confirm OpenProject updates tasks and partial failures are shown.
7. Assign a task to a user whose email exists as a local tracker user.
8. Confirm the bell shows a real notification.
9. As an owner/admin, open the Import Reports menu and open the latest report detail modal.
10. Confirm the modal shows tasks imported, users imported, assignees mapped, and warnings/errors counts.
11. Use `Copy JSON` or `Download JSON` and confirm the payload matches the visible summary.
12. Open `Workspace settings -> Imports` and confirm reports can also be opened from there.

## Optional ClickUp Migration

`npm run seed:openproject:clickup` is a one-time migration helper. It can read ClickUp data and create/reuse OpenProject projects/work packages.

This script may use `CLICKUP_TOKEN`, but the tracker runtime does not.

### Verify ClickUp Users And Permissions Migration

Use an OpenProject admin/API token with permission to manage users and memberships. If the token cannot create users or memberships, the seed should continue importing projects/tasks and print clear `openProjectUserErrors`, `openProjectMembershipErrors`, and `permissionWarnings`.

1. Set migration env values:

   ```bash
   CLICKUP_TOKEN="..."
   OPENPROJECT_API_TOKEN="admin-or-manage-user-token"
   OPENPROJECT_IMPORTED_USER_PASSWORD="Clickup!2026"
   CLICKUP_IMPORTED_USER_PASSWORD="clickup!2026"
   OP_IMPORTED_ADMIN_EMAILS=""
   ```

2. Run the one-time migration:

   ```bash
   npm run seed:openproject:clickup
   ```

3. In OpenProject administration, verify users from ClickUp exist.
4. Log in to OpenProject as one imported user:
   - login/email: the ClickUp email, or `clickup-<id>@local.clickup.invalid` if ClickUp had no email
   - password: `OPENPROJECT_IMPORTED_USER_PASSWORD`, default `Clickup!2026`
5. Check project memberships:
   - ClickUp workspace members are applied to mapped Space/Folder/List projects.
   - Explicit ClickUp space members, when returned by `GET /space/{space_id}` fields such as `members`, `users`, `permissions`, `access`, `sharing`, or `shared`, are applied to the mapped Space project and inherited by child projects.
   - Explicit ClickUp folder members, when returned by `GET /folder/{folder_id}` in the same access/sharing fields, are applied to the mapped Folder project and inherited by child list projects.
   - Explicit ClickUp list members from `GET /list/{list_id}/member` are applied to the mapped list project.
   - Task assignees get at least Member access to the mapped list project.
   - The first ClickUp assignee becomes the OpenProject assignee when OpenProject accepts the mapping.
   - The second ClickUp assignee becomes the OpenProject responsible when available.
   - Additional ClickUp assignees are preserved in the imported metadata block when watcher mapping is not available yet.
6. Open the same imported user in the tracker UI and confirm:
   - the local tracker account exists;
   - it can log in with `CLICKUP_IMPORTED_USER_PASSWORD` if newly created;
   - the profile shows the linked OpenProject user.
7. Open an imported task that had ClickUp assignees and confirm:
   - primary assignee is set on the OpenProject work package;
   - second assignee is set as responsible or stored in fallback metadata;
   - additional assignees are not silently lost;
   - when OpenProject rejects assignee or responsible, the imported task description still keeps a
     `Additional assignees` block with each fallback user name, email, and `ClickUp ID`.
6. Check inheritance:
   - Space-level grants are applied to folder/list subprojects.
   - Explicit list access does not grant access to unrelated top-level spaces.
7. Run the seed twice:
   - no duplicate OpenProject users
   - no duplicate memberships
   - existing stronger roles are not downgraded
   - weaker roles are upgraded when ClickUp access requires it
8. Pick a ClickUp task with multiple assignees and open the mapped OpenProject work package:
   - confirm the primary assignee is set;
   - confirm the second assignee is set as responsible when supported;
   - confirm any remaining assignees are preserved in task metadata instead of being dropped;
   - if you intentionally reproduce an OpenProject assignee validation failure, confirm the task is
     still imported and all assignees remain visible in the fallback metadata block.

Current ClickUp permission source limitations:

- `team.members` is treated as workspace-wide membership.
- Space/folder explicit grants are extracted only when ClickUp returns access fields in the Space/Folder API responses.
- Explicit list members are read through `GET /list/{list_id}/member` when available.
- Private spaces/folders without returned explicit member fields emit warnings and inherit known workspace/list/assignee grants.

`OPENPROJECT_IMPORTED_USER_PASSWORD` is only for real OpenProject users created during migration. `CLICKUP_IMPORTED_USER_PASSWORD` is only for local tracker users created for the local auth scaffold.

## Clean OpenProject And Re-import From ClickUp

Use this when OpenProject already contains stale test projects, duplicated tasks, or broken previous imports.

1. Check what would be deleted:

   ```bash
   npm run reset:openproject -- --dry-run
   ```

2. Confirm the dry-run summary lists the OpenProject work packages and projects you expect to remove.
3. Verify that dry-run did not delete anything.
4. Run the real destructive reset:

   ```bash
   npm run reset:openproject -- --yes --confirm DELETE_ALL_OPENPROJECT_PROJECTS_AND_WORK_PACKAGES
   ```

5. If `NODE_ENV=production`, add `--allow-production`.
6. Confirm the reset summary reports deleted work packages and deleted projects.
7. Confirm OpenProject users, roles, statuses, priorities, and custom fields still exist.
8. Confirm local Prisma users, local docs, and GitHub repository settings still exist.
9. Confirm `server/openproject/seed-data/clickup-hierarchy.json` is gone and the old hierarchy no longer appears in the UI.
10. Re-run the ClickUp migration:

   ```bash
   CLICKUP_TOKEN="..." npm run seed:openproject:clickup
   ```

11. Start the tracker:

   ```bash
   npm run dev
   ```

12. Verify the sidebar contains only the fresh ClickUp-imported structure.
13. Verify task lists contain only the fresh ClickUp-imported tasks.
14. Find a ClickUp task with an assignee and confirm the mapped OpenProject work package has:
   - primary assignee set
   - second assignee mapped to responsible when present
   - remaining assignees preserved in task metadata when more than two existed in ClickUp
15. Run the seed a second time and confirm there are no duplicate projects, work packages, users, or memberships.

The reset intentionally does not delete OpenProject users, roles, statuses, priorities, custom fields, workflows, local tracker users, local auth/session data, Local Docs, or GitHub repository settings.

## Final Verification

```bash
npm test
npm run build
```

Unit tests mock network calls and do not require a real OpenProject instance unless a test is explicitly marked as integration.
