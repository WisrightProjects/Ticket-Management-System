# Right Tracker support platform upgrade

Approved scope: one shared login with individual customer accounts, invitation-based
activation, organization isolation, professional customer and staff workspaces.
Implementation and verification use local PostgreSQL only. Never migrate or seed live.
Existing uncommitted UI work must be preserved. No commit, push or deployment is authorized.

## Phase 1 — Foundation
- RT-04 (P0): As an admin, I want organizations and explicit memberships so customer
  access comes from server-side records. Add Organization, Membership and Invitation
  models; link tickets to organizations/requesters; report unmapped legacy records.
- RT-05 (P0): As a customer, I want private requests. Enforce organization and requester
  checks on lists, details, replies, ratings, approvals and attachment downloads.
  Customer managers can read their organization's requests; approval remains requester-only.
- RT-11 (P0): As a manager, I want enforced transitions. Validate status on the backend,
  restrict implementation controls to admins, record history and completion timestamps.
- RT-16 (P0): As an owner, I want a safe migration. Preserve IDs and existing records,
  add a localhost-only development guard, document rollback and integration compatibility.

## Phase 2 — Customer experience
- RT-01 (P0): Common /login, role-based routing, safe return URLs and legacy redirects.
- RT-02 (P0): Admin invites an organization member; expiring single-use token; customer
  sets display name/password. Support revocation/resending. Never email passwords.
- RT-03 (P0): Password reset, profile editing, active-account checks and generic errors.
- RT-06 (P1): Customer overview with active/waiting/resolved counts and recent requests.
- RT-07 (P1): Guided authenticated submission with category, details, attachments,
  implementation fields, server-derived identity and duplicate-submit protection.
- RT-08 (P1): Request list/detail with friendly statuses, conversation, next actions,
  private attachments, plan approval/rejection, rating and reopening.
- RT-15 (P1): Consistent neutral surfaces, restrained WisRight accents, readable tables,
  shared controls, keyboard access, responsive layout and useful feedback states.

## Phase 3 — Staff experience
- RT-09 (P1): Assigned-to-me, unassigned, waiting, overdue and recently updated queues;
  URL filters, search, sorting, pagination and permission-aware bulk actions.
- RT-10 (P1): Conversation/detail sidebar, public replies versus internal notes,
  history and draft preservation. Admin organization/customer/invitation management.

## Phase 4 — Operational quality
- RT-12 (P1): Durable deduplicated inbound processing and retryable notifications;
  sender authorization, no internal-note leakage, acknowledge after persistence.
- RT-13 (P2): SLA policies with business hours, pause rules, first-response/resolution
  targets and escalation events. Surface approaching and breached deadlines.
- RT-14 (P1): Explicit response/resolution/closure timestamps, AI attribution and audit
  events; reporting must not infer AI resolution from OPEN_DONE or time from updatedAt.

## Phase 5 — Release
Verify local migrations, API permissions, browser journeys, integration compatibility,
builds and tests. Prepare staging/release and rollback instructions. Production migration
and deployment remain separate actions, requiring a verified target and release review.

## Technical contract
Shared schemas in packages/core. Prisma models/migrations in server/prisma. Organization
and invitation APIs under /api/organizations; activation under /api/onboarding. Customer
context under /api/portal/me; authenticated submission under /api/portal/requests.
Use common backend visibility predicates for all customer resources, including files.
Legacy portal URLs remain navigable but do not grant membership. Keep staff and customer
shells distinct with shared typography, spacing, semantic statuses and components.

## Acceptance gate
An admin creates an organization/invitation; a customer activates and logs in at /login,
submits a private request, reads replies, tracks status and reopens/rates when allowed.
A second organization cannot read or mutate it. Agents process it through valid states.
Test invitation expiry/replay, cross-tenant IDs/files, invalid transitions and old URLs.

## Progress
- Phase 1: source implementation added; local schema SQL verified; full API gate pending.
- Phase 2: common login, activation, organization invitations and customer workspace added;
  component/build and mocked browser checks available. Full database journey gate pending.
- Phase 3: staff queues, teams, private saved views, due dates, atomic bulk edits,
  ownership checks, metadata audit and scoped reply drafts implemented in source.
  See `stories/staff-queues-and-workspace.md`. Real API/local startup gate remains blocked.
- Phase 4: timestamp/AI metrics foundation started; durable email and SLA work remains.
- Phase 5: pending integration verification, staging review and release preparation.
- Details and local-only setup: `docs/support-platform-local-upgrade.md`.
