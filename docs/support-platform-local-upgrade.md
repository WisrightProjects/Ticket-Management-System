# Support platform upgrade: local development and progress

## Scope and safety

The approved backlog is `stories/support-platform-upgrade.md`. Existing uncommitted UI
work was retained. Nothing was committed, pushed, deployed, migrated or seeded against
the live database. Do not use `server/.env.live.backup` for development.

`server/.env` now targets **127.0.0.1:5433/ticket_management** with newly generated local
credentials. The previous configuration is preserved in the gitignored
`server/.env.live.backup`. Local admin credentials are in `server/.env`; they are not
documented in source control. No live data was copied. Email, Gmail, HRMS, WiseWork and
AI credentials are absent from the local environment, so they cannot contact live services.

Development/test Prisma connections reject non-loopback database hosts. The extra
`LOCAL_DEVELOPMENT_ONLY=true` flag enforces the restriction even if NODE_ENV is changed.
Test setup/teardown additionally require the database name `ticket_management_test`
before dropping or truncating anything.

## Current implementation

### Phase 1: implemented in source, integration gate pending

- Organization, membership and hashed single-use invitation models.
- Ticket organization/requester links, resolution/response timestamps, AI attribution,
  resolution summary, request idempotency keys and internal-note visibility.
- Legacy association backfill from explicit HRMS client IDs. Review it in staging:
  previously self-selected portal associations are not proof of approved membership.
- Shared customer visibility predicates guard detail/actions, lists and downloads.
- Customer manager read access; requester-only mutations and plan approval.
- Browser-selected company binding and open customer signup disabled.
- Shared legal status choices, backend transition checks, admin implementation controls,
  mandatory human resolution summary and status history.
- Local schema SQL applied successfully in a dedicated validation database.

### Phase 2: implemented in source, integration gate pending

- Common `/login`, role-based destinations and safe return paths.
- `/activate?token=...`: display name/password setup using an expiring invitation.
- Admin `/organizations`: create organizations, list members, invite/revoke; issuing a
  replacement invitation revokes earlier pending invitations for that organization/email.
- Admin-only manual activation link supports local use without SMTP. Email delivery
  failures are shown explicitly. Links must be shared with the intended recipient only.
- Professional customer shell, overview, searchable request list, URL filters,
  authenticated two-step submission, profile and password-reset navigation.
- Friendly statuses and existing detail/approval/rating/reopening pages retained.
- Legacy company login/submission URLs redirect to the shared authenticated experience.

### Phase 3: implemented in source, real API gate pending

- `/work` offers active/mine/unassigned/team/waiting/overdue/recent views, counts,
  URL filters, sorting, pagination and private saved views.
- `/teams` provides admin team creation and membership editing. Membership removal
  is blocked while the member still owns tickets in that team.
- Bulk assignment, priority, status, team and deadline changes validate all selected
  tickets and write audit events in one transaction. Agents can claim eligible unassigned
  work and edit their own tickets; other-agent, team and deadline changes require admins.
- Existing single-ticket editors enforce the same ownership rules. Status, assignment,
  priority, project/type/hour/team/deadline edits are audited; comments and attachments
  commit together. The priority board and existing ticket URLs remain available.
- Ticket workspace preserves its originating queue, has conversation/activity tabs,
  routing/deadline controls, read-only states and separate public/internal draft text.
- Drafts are scoped by user/ticket/visibility in this browser tab, retained across
  navigation and cleared on staff sign-out. File attachments must be reselected after
  leaving the page. Stale AI polish results do not replace subsequent edits.
- Overdue is based on explicit due dates on unresolved tickets; it is not an SLA claim.

### Phase 4: partially implemented

Explicit completion timestamps and AI attribution replace some misleading metrics.
Durable email intake/outbox, retry administration, notification preferences, SLA policies,
business calendars, escalation and a full report audit remain. Existing email integration
is not represented as production-hardened by this change.

### Phase 5: pending

No staging or production release has occurred. Full API/database integration and legacy
suite updates are required before release. Schema success and mocked browser tests do
not establish production readiness.

## Running locally

PostgreSQL 17 binaries are installed at `C:/Program Files/PostgreSQL/17/bin`. A project-owned
cluster is initialized under `.local/postgres`; that entire directory is gitignored.

From the repository root in PowerShell:

```powershell
.\scripts\start-local.ps1
```

The launcher validates localhost database names/ports, disables external integrations,
applies migrations, seeds only local accounts, launches backend/frontend and checks health.
It fails safely if PostgreSQL cannot bind a socket. It never falls back to a remote database.
The following manual commands are an alternative when the local database is already running.

Then from `server/` (the local `.env` is loaded):

```powershell
bun node_modules/prisma/build/index.js migrate deploy
bun run prisma/seed.ts
bun run src/index.ts
```

From `client/`:

```powershell
bun run dev
```

Open `http://localhost:5173/login`, sign in using the local admin credentials, create an
organization and invite a customer. Copy the local activation link, activate in a separate
browser profile, sign in and submit a request. Check a second organization cannot access it.

The current managed execution environment denies TCP listeners (EACCES), including
PostgreSQL on 5433/55432 and a plain Node localhost listener. Therefore the API cannot
be run here against PostgreSQL. Do not work around this by using a remote database.

The migration SQL was checked using PostgreSQL single-user mode without network access,
in **ticket_management_schema_check**. The application database **ticket_management** and
test database **ticket_management_test** were subsequently created empty so ordinary Prisma
migrations can run normally once local networking is available. The schema-check database
is validation-only and has no Prisma migration journal; do not point the application at it.

## Verification

- Server TypeScript and frontend TypeScript/build checks.
- Component/unit regression suite: 140 tests passed, including shared workflow rules
  and user/ticket/visibility isolation of reply drafts.
- `bun test server/src/lib/work-queue.test.ts server/src/lib/staff-ticket-service.test.ts server/src/lib/database-safety.test.ts`
  passed 10 backend tests for local isolation, queue policy, claims, bulk prevalidation and audit.
- `node node_modules/@playwright/test/cli.js test --config playwright.ui.config.ts`
  checks the built customer UI using mocked API responses and no HTTP/database server.
  Eleven mocked browser checks cover customer flows and staff queue filters/pagination,
  saved views, reviewed bulk edits/conflicts, claims, draft recovery, stale AI responses
  and mobile layouts. These do not replace real database integration tests.
  Build `client/` first. Set PLAYWRIGHT_BROWSERS_PATH to the host browser cache if needed.
- `tests/support-platform.spec.ts` contains real API onboarding, privacy, internal-note,
  invitation replay and transition checks. These require the local server/database.
- `tests/staff-workspace.spec.ts` covers real API bulk atomicity, team membership,
  same-policy single edits, overdue exclusion, saved-view privacy and metadata history.
- Existing tests that use public signup, `/me/client` or arbitrary status jumps must be
  migrated to invitation/membership fixtures; those old behaviors are intentionally removed.
- Attempting the real API suite also hit the sandbox's Bun web-server startup error
  (`CouldntReadCurrentDirectory`). No API integration tests are claimed as passing.

## Release and rollback gate

1. Review unmapped tickets/customers via admin `/api/organizations/migration-review`.
2. Verify every imported membership against approved client contacts.
3. Exercise invitation expiry/revocation/replay and second-organization access tests.
4. Check private attachments, internal-note isolation and HRMS/WiseWork compatibility.
   Authenticated upload downloads change external image-link behavior; signed short-lived
   integration downloads remain to be designed before enabling external snapshot consumers.
5. Complete missing queue, notification, SLA and reporting stories and run the full updated suite.
6. Back up the target database and uploads in staging; rehearse upgrade and restoration.
7. Release only after a separate production review. Rollback must restore a matching database
   and application snapshot; do not drop new organization data to emulate a down migration.
