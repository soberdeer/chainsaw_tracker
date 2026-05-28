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

**PostgreSQL/Prisma** holds the local extension layer only: auth sessions, workspace roles, saved views, notifications, board order, docs, GitHub bindings, tag metadata, and import reports.

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
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/compact_tracker?schema=public"
PORT=4000
CLIENT_URL="http://localhost:5173"

OPENPROJECT_BASE_URL="http://localhost:8080"
OPENPROJECT_API_TOKEN="opapi-..."
OPENPROJECT_TIMEOUT_MS=15000
```

`OPENPROJECT_API_TOKEN` is a server-side token for the admin OpenProject account. It is never sent to the frontend. See [Authentication](#authentication) for how to get one.

### 3. Start the local database

```bash
npm run db:up       # starts the bundled Docker Postgres
npm run db:sync     # runs Prisma migrations + generates client
```

If you have Postgres running locally already, skip `db:up` and just run `db:sync`.

On Colima:

```bash
colima start
npm run db:up
npm run db:sync
```

### 4. Set up OpenProject (fresh install only)

If OpenProject is a new install, run:

```bash
npm run setup:openproject
```

This script:

- Verifies the API token. If `OPENPROJECT_API_TOKEN` is missing or invalid it **auto-generates one** by running a Rails command inside the Docker container (`openproject-web-1`) and writes the result to `.env`.
- Creates the required statuses: `Backlog`, `Scoping`, `In Progress`, `On Hold`, `Shipped`, `Cancelled`.
- Deletes the default Demo project and Scrum project if real projects already exist.

Run it again after seeding to clean up demo projects if they were skipped on first run.

### 5. Start the app

```bash
npm run dev
```

- Frontend: `http://localhost:5173`
- API: `http://localhost:4000`

### 6. Sign in

Open `http://localhost:5173`. Sign in with your **OpenProject email** and **OpenProject API token** (not your OpenProject web password).

To get your personal API token in OpenProject: avatar → My account → Access tokens → API → + API token.

The token starts with `opapi-`.

## Authentication

Users authenticate with their OpenProject credentials. There are no local passwords.

- `email` — your OpenProject account email
- `password` field — your personal OpenProject API token (`opapi-...`)

On first login the app creates a local account linked to your OpenProject user. The first person to log in becomes the workspace Owner automatically.

The server-side `OPENPROJECT_API_TOKEN` in `.env` is a separate admin token used for background API calls (importing, membership sync, etc.). It does not grant UI access on its own.

## Roles & Permissions

Local workspace roles control access to tracker features. OpenProject project memberships control access to work packages.

| Role | Can do |
|---|---|
| `OWNER` | Everything, including workspace settings and member management |
| `ADMIN` | Same as Owner |
| `LEAD` | Create/edit tasks, change statuses, comment, manage saved views |
| `MEMBER` | Create/edit accessible tasks, change statuses, comment, log time |
| `VIEWER` | Read-only |

The first user to log in is assigned `OWNER`. Additional users get `MEMBER` by default and can be promoted from Workspace Settings → Members.

## Scripts Reference

```bash
npm run dev                       # start frontend + API in watch mode
npm run build                     # production build
npm run test                      # format check + lint + typecheck + unit tests
npm run e2e                       # Playwright end-to-end suite
npm run e2e:ui                    # Playwright with interactive UI

npm run setup:openproject         # configure fresh OpenProject: token + statuses + demo cleanup
npm run seed:openproject:clickup  # one-time ClickUp → OpenProject migration
npm run reset:openproject         # wipe OpenProject projects and work packages (guarded)

npm run db:up                     # start Docker Postgres
npm run db:down                   # stop Docker Postgres
npm run db:sync                   # prisma migrate dev + generate
npm run db:logs                   # tail Postgres logs
npm run docker:check              # verify Docker daemon is reachable

npm run format                    # auto-format all source files
npm run format:check              # check formatting without writing
npm run lint                      # oxlint
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

The reset removes work packages and projects only. It does not touch users, roles, statuses, priorities, custom fields, or local Prisma data. After reset, run the seed again.

## After Pulling Changes

Always sync Prisma after pulling:

```bash
npm run db:sync
```

This applies any new migrations and regenerates the Prisma client. Missing it causes runtime errors like `table X does not exist`.

## Troubleshooting

**`The table public.X does not exist`**
Run `npm run db:sync`.

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
| `DATABASE_URL` | Yes | Postgres connection string |
| `PORT` | Yes | API server port (default `4000`) |
| `CLIENT_URL` | Yes | Frontend origin for CORS |
| `OPENPROJECT_BASE_URL` | Yes | OpenProject instance URL |
| `OPENPROJECT_API_TOKEN` | Yes | Admin API token (`opapi-...`) |
| `OPENPROJECT_TIMEOUT_MS` | No | API request timeout (default `15000`) |
| `SESSION_SECRET` | No | HMAC secret for session cookies |
| `CLICKUP_TOKEN` | No | ClickUp API token (migration only) |
| `GITHUB_TOKEN` | No | GitHub token (GitHub integration) |
| `GITHUB_WEBHOOK_SECRET` | No | Webhook HMAC secret |
