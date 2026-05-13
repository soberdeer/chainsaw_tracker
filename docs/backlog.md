# Compact Tracker MVP Backlog

## Scope

Build a reduced ClickUp-like tracker without AI, app marketplace, scheduler, mail client, whiteboards, or non-GitHub integrations.

## Epics

1. Workspace and spaces
   - Create workspace and team membership model.
   - Create spaces with folders.
   - Support per-space permissions inherited from workspace roles.

2. Tasks
   - List and Kanban views.
   - Status columns, priority, assignee, due date, tags.
   - Task CRUD inside folders.

3. Docs
   - Store uploaded images as files.
   - Store Markdown documents.
   - Convert `.docx`, `.txt`, and other text files to Markdown on upload.
   - Convert spreadsheets to Markdown tables on upload.
   - Add link embeds for external boards, Google Drive PDFs, and similar iframe-compatible resources.

4. Team and permissions
   - Invite users by email.
   - Roles: owner, admin, member, viewer.
   - Permission presets: manage workspace, manage spaces, manage docs, manage tasks, invite members.

5. GitHub integration
   - Store one GitHub integration per workspace.
   - Link tasks to GitHub issues or pull requests by URL.

6. Product polish
   - Mantine shell with sidebar navigation.
   - Empty states and responsive list/board layouts.
   - Seed/demo data for local review.

## Out of Scope

- AI features.
- App marketplace or custom apps.
- Scheduler/calendar.
- Mail client.
- Whiteboards.
- Non-GitHub integrations.
