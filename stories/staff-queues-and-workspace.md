# Phase 3 — Staff queues and ticket workspace

Approved by the user's request to continue the remaining phases, starting with staff
queues and workspace. Build on existing uncommitted work. Local database only; no
live access, deployment, commit or push.

## RT-09: Operational queues
As a staff member, I want searchable, shareable work queues so I can triage requests.

Acceptance:
- `/work` provides All active, Assigned to me, Unassigned, My teams, Waiting for customer,
  Overdue and Recently updated views with matching counts.
- Search reference/title/requester; filter organization, team, priority, type and status;
  sort and paginate on the server. State is in the URL and survives opening a ticket/back.
- Overdue is an explicit `dueAt` before now on unresolved tickets. No invented SLA targets.
- Personal saved views are stored per authenticated staff user; other users cannot delete them.
- Admins can bulk assign active staff, priority, team, due date or legal status transitions.
  Agents can claim eligible unassigned requests for themselves or update their own requests;
  they cannot reassign to other people or change teams. Apply the same policy to single edits.
- Bulk changes are atomic: invalid/inaccessible/missing tickets cause zero changes. Maximum
  50 unique readable ticket references; server validates every target and workflow.
- Teams are managed by admins, with active staff membership and ticket team assignment.

## RT-10: Working on a ticket
As an agent, I want a consistent workspace that preserves context and unsent text.

Acceptance:
- Breadcrumb back to the originating queue, description, conversation/activity tabs and
  a sticky metadata sidebar. Existing ticket URLs and priority board remain usable.
- Separate Public reply / Internal note modes; explicit visibility guidance.
- Text drafts are isolated by user, ticket and visibility in sessionStorage; retain them
  across navigation/refresh, clear the sent draft only, and clear all drafts on sign-out.
  File inputs cannot be restored after remount; the UI says to reattach files.
- Switching tickets/modes or an unrelated refetch never replaces a different draft.
- Reply errors preserve text; stale AI polish results cannot overwrite subsequent edits.
- Metadata changes record actor, field, old/new values in the same transaction. History
  refreshes after edits. Public/internal comments and uploaded attachment writes are atomic.
- Admin controls and agent read-only states agree with backend permissions.
- Responsive table overflow and stacked workspace; labels, focus states, empty/error/loading states.

## Technical plan
Shared Zod contracts in `packages/core/src/schemas/work.ts`. Add Team, TeamMember and
QueueView models plus nullable Ticket.teamId/dueAt and indexes in a new migration.
Implement `/api/work` queue/options/saved-view/bulk/team endpoints and shared staff mutation
policy/service. Reuse legal transitions, reply/upload utilities, existing metadata and history.
Mount queue APIs separately so existing ticket endpoints and WiseWork creation stay compatible.
Add queue/team pages, scoped draft hook and workspace refinements. Keep the priority board.
Update Playwright API and mocked-browser coverage, unit tests, builds and progress docs.

## Verification and limits
Use loopback database URLs exclusively. The environment currently rejects localhost TCP;
retry the local availability check and otherwise verify migration SQL with local PostgreSQL
single-user mode, mock-browser journeys and unit/build checks. Do not claim API integration
passes if the server cannot start. Phase 4 durability/SLA and Phase 5 release remain separate.

## Implementation evidence
- Migration `20261028000300_staff_queues` applied successfully to the local
  `ticket_management_schema_check` database with PostgreSQL single-user mode.
- Staff `/work` and admin `/teams` added; priority board retained at `/tickets`.
- Frontend regression and draft tests: 140 passed. Backend queue/policy/atomic-validation
  tests: 10 passed. Browser fixture journeys cover staff plus existing customer pages.
- Real API tests are written in `tests/staff-workspace.spec.ts`; they require the local
  PostgreSQL server and are not claimed as executed successfully in this sandbox.
- `scripts/start-local.ps1` validates loopback targets, applies local migrations/seeds,
  disables external integrations, starts hidden app processes, checks health and opens
  the local login. Execution here stops safely when Windows refuses the PostgreSQL socket.
