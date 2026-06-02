# OpenProject Tracker

React task tracker that uses OpenProject as the source of truth for all task data, with a ClickUp-style UI layer on top.

## Architecture

**OpenProject** holds everything task-related:

| OpenProject | Tracker UI |
|---|---|
| Project | Space |
| Subproject | Folder |
| Work packages view | List |
| Work package | Task |
| Status | Column / group |
| Priority | Priority badge |
| User | Assignee / responsible |
| Parent link | Subtask |
| Activity / comment | Timeline |

The tracker has no local database. All task data lives in OpenProject. The Express API proxies OpenProject's REST API and handles auth sessions in memory.

## Prerequisites

- Node.js 22+
- Docker Desktop (or Colima on macOS)
- A running OpenProject instance (17+)

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure `.env`

```bash
cp .env.example .env
```

Minimum required values:

```env
PORT=4000
CLIENT_URL="http://localhost:5173"

OPENPROJECT_BASE_URL="http://localhost:8080"
OPENPROJECT_API_TOKEN="opapi-..."
OPENPROJECT_TIMEOUT_MS=15000
```

`OPENPROJECT_API_TOKEN` is a server-side token for the admin OpenProject account. It is never sent to the frontend. See [Authentication](#authentication) for how to get one.

### 3. Set up OpenProject (fresh install only)

If OpenProject is a new install, run:

```bash
npm run setup:openproject
```

This script:

- Verifies the API token. If `OPENPROJECT_API_TOKEN` is missing or invalid it **auto-generates one** by running a Rails command inside the Docker container (`openproject-web-1`) and writes the result to `.env`.
- Creates the required statuses: `Backlog`, `Scoping`, `In Progress`, `On Hold`, `Shipped`, `Cancelled`.
- Deletes the default Demo project and Scrum project if real projects already exist.

Run it again after seeding to clean up demo projects if they were skipped on first run.

### 4. Start the app

```bash
npm run dev
```

- Frontend: `http://localhost:5173`
- API: `http://localhost:4000`

### 5. Sign in

Open `http://localhost:5173`. Sign in with your **OpenProject email** and **OpenProject API token** (not your OpenProject web password).

To get your personal API token in OpenProject: avatar → My account → Access tokens → API → + API token.

The token starts with `opapi-`.

## Authentication

Users authenticate with their OpenProject credentials. There are no local passwords.

- `email` — your OpenProject account email
- `password` field — your personal OpenProject API token (`opapi-...`)

On first login the app creates a local session linked to your OpenProject user. The first person to log in becomes the workspace Owner automatically.

The server-side `OPENPROJECT_API_TOKEN` in `.env` is a separate admin token used for background API calls (importing, membership sync, etc.). It does not grant UI access on its own.

## Roles & Permissions

### Workspace roles

Local workspace roles control access to tracker features.

| Role | Can do |
|---|---|
| `ADMIN` | Everything: workspace settings, member management, all task/doc operations |
| `MEMBER` | Create/edit tasks, manage docs, view reports |
| `READER` | Read-only |

The role of each user is determined by their `admin` flag in OpenProject. Change it from **Workspace Settings → Members** — each row has an Administrator / Member dropdown that writes back to OpenProject immediately.

### OpenProject project roles

Project-level access (which work packages a user can see/edit inside a specific project) is managed per-project. Open a space in the sidebar and click the **people icon (👥)** to see and edit project memberships.

Supported project roles shown in the UI: **Project admin**, **Member**, **Reader**.

From the Project access modal you can:
- Change a member's project roles (MultiSelect)
- Remove a member from the project (trash icon)
- Add a new member to the project (Add member button)

## Scripts Reference

```bash
npm run dev                       # start frontend + API in watch mode
npm run dev:web                   # frontend only
npm run dev:api                   # API only
npm run build                     # production build
npm run test                      # format check + lint + typecheck + unit tests
npm run e2e                       # Playwright end-to-end suite
npm run e2e:ui                    # Playwright with interactive UI
npm run e2e:headed                # Playwright in headed browser
npm run e2e:debug                 # Playwright debug mode

npm run setup:openproject         # configure fresh OpenProject: token + statuses + demo cleanup
npm run seed:openproject:clickup  # one-time ClickUp → OpenProject migration
npm run reset:openproject         # wipe OpenProject projects and work packages (guarded)
npm run reset:full                # full environment reset (setup + seed + password reset + verify)
npm run reset:clear               # clear data only, skip setup and seed
npm run reset:passwords           # reset OpenProject user passwords
npm run snapshot:openproject      # snapshot current OpenProject state
npm run verify:openproject        # verify OpenProject connectivity and state

npm run docker:check              # verify Docker daemon is reachable

npm run format                    # auto-format all source files
npm run format:check              # check formatting without writing
npm run lint                      # oxlint
npm run lint:fix                  # oxlint with auto-fix
npm run typecheck                 # tsc --noEmit for all tsconfigs
```

## ClickUp Migration (optional)

`seed:openproject:clickup` is a one-time migration that reads ClickUp data and creates OpenProject projects, work packages, users, and memberships. It is not required to run the tracker.

Add `CLICKUP_TOKEN` to `.env`, then:

```bash
npm run seed:openproject:clickup
```

The seed script:
- Maps ClickUp Spaces → OpenProject projects
- Maps Folders → subprojects
- Maps Lists → deeper subprojects
- Maps tasks → work packages with status, priority, assignees, due dates
- Creates OpenProject users for each ClickUp member
- Assigns project memberships based on Space/List/task access
- Deletes default Demo and Scrum projects at the end

ClickUp status mapping (when no exact name match):

| ClickUp type | Maps to OpenProject |
|---|---|
| closed / done / shipped | Shipped |
| review / testing | In Progress |
| in development / progress | In Progress |
| hold / blocked / waiting | On Hold |
| scoping / design / planning | Scoping |
| everything else | Backlog |

## Clean Re-import

When OpenProject already has stale projects from a previous import:

```bash
# Preview what would be deleted (safe)
npm run reset:openproject -- --dry-run

# Actual destructive reset
npm run reset:openproject -- --yes --confirm DELETE_ALL_OPENPROJECT_PROJECTS_AND_WORK_PACKAGES
```

In production, add `--allow-production`.

The reset removes work packages and projects only. It does not touch users, roles, statuses, priorities, custom fields, or local session data. After reset, run the seed again.

## Troubleshooting

**`401 Unauthorized` on API calls**
The `OPENPROJECT_API_TOKEN` in `.env` is invalid or expired. Run `npm run setup:openproject` to auto-generate a fresh one (requires `openproject-web-1` container to be running).

**`403` on `/api/v3/statuses`**
No active OpenProject projects exist. Run `npm run setup:openproject` — it activates archived projects or creates a bootstrap project automatically.

**Docker / Colima socket error**
```bash
colima start          # if using Colima
# or
docker context use default   # if using Docker Desktop
npm run docker:check
```

**`openproject-web-1` not found (token generation fails)**
The container name depends on the Compose project name. Check with `docker ps` and pass the correct name via the `OPENPROJECT_CONTAINER` environment variable, or generate a token manually:

```bash
docker exec <container-name> bundle exec rails runner \
  'u=User.where(admin:true,type:"User").first; t=Token::API.create!(user:u); puts t.plain_value'
```

Then set `OPENPROJECT_API_TOKEN=<value>` in `.env`.

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `PORT` | Yes | API server port (default `4000`) |
| `CLIENT_URL` | Yes | Frontend origin for CORS |
| `OPENPROJECT_BASE_URL` | Yes | OpenProject instance URL |
| `OPENPROJECT_API_TOKEN` | Yes | Admin API token (`opapi-...`) |
| `OPENPROJECT_TIMEOUT_MS` | No | API request timeout in ms (default `15000`) |
| `OPENPROJECT_WORKSPACE_NAME` | No | Display name for the workspace |
| `OPENPROJECT_TAGS_CF_ID` | No | OpenProject custom field ID used for tags |
| `OPENPROJECT_AUTH_MODE` | No | Auth mode for API calls (`basic` or `token`, default `token`) |
| `SESSION_SECRET` | No | HMAC secret for session cookies |
| `GITHUB_INTEGRATION_ENABLED` | No | Enable GitHub integration (`true`/`false`, default `false`) |
| `GITHUB_TOKEN` | No | GitHub token (GitHub integration) |
| `GITHUB_WEBHOOK_SECRET` | No | Webhook HMAC secret |
| `GITHUB_APP_ID` | No | GitHub App ID |
| `GITHUB_PRIVATE_KEY` | No | GitHub App private key |
| `GITHUB_CLIENT_ID` | No | GitHub OAuth client ID |
| `GITHUB_CLIENT_SECRET` | No | GitHub OAuth client secret |
| `CLICKUP_TOKEN` | No | ClickUp API token (migration only) |
| `OPENPROJECT_ADMIN_PASSWORD` | No | Admin password for fresh OpenProject installs (migration only) |
| `OPENPROJECT_IMPORTED_USER_PASSWORD` | No | Default password assigned to imported users (migration only) |
| `OP_IMPORTED_ADMIN_EMAILS` | No | Comma-separated emails to promote to admin after import (migration only) |
