# Compact Tracker

Compact task tracker built with React, Vite, Express, Prisma, Postgres and Mantine.

## Local Setup

1. Start Postgres and run migrations:

```bash
npm run setup
```

2. Start the app:

```bash
npm run dev
```

The app runs at `http://localhost:5173`, API at `http://localhost:4000`.

If you already have Postgres running, make sure `.env` points to an existing database:

```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/compact_tracker?schema=public"
```

## Email Invites

Invites are sent through SMTP when these env vars are configured:

```bash
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=...
SMTP_PASS=...
MAIL_FROM="Compact Tracker <no-reply@example.com>"
CLIENT_URL=http://localhost:5173
```

Without SMTP, the API logs the invite email to the console and still returns the invite link for local development.

Then run:

```bash
npm run setup:local
```

## ClickUp CSV Import

Use the `Import CSV` button or `POST /api/imports/clickup-csv`. The importer upserts ClickUp tasks by `externalSource=CLICKUP` and `externalId`, keeps `externalUrl`, `syncedAt`, and the raw external snapshot, and does not duplicate tasks on repeat imports.

Sync conflict rule: ClickUp imports update local editable fields only when the task has not been changed locally after its last sync. Otherwise the importer refreshes `externalTitle`, `externalDescription`, and `externalStatus` without silently overwriting local edits.

## Optional Existing GitHub Code

GitHub integration is not required for the core tracker and is not part of the current task scope. Existing GitHub-related code is optional and should not block task list, task detail, ClickUp import, CRUD, or Activity.

Optional env vars:

```bash
GITHUB_INTEGRATION_ENABLED=false
GITHUB_WEBHOOK_SECRET=...
GITHUB_TOKEN=...
```

When GitHub is disabled or env is missing, GitHub-dependent routes return disabled/empty responses and the production task UI does not show fake GitHub data.
