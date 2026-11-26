# Card-Based List Views (Tickets, Users, Clients)

## Overview

The previous UI redesign pass (`stories/professional-ui-redesign.md`) was explicitly a visual/styling-only pass — same DOM structure, just tokens/colors/spacing. After seeing it live, the user wants a real structural change: the three main staff list pages (Tickets, Users, Clients) currently render as HTML tables, which reads as a dense internal admin tool. Replacing them with card-based layouts moves the app closer to the Zoho Desk/Freshdesk-style ticket queue look that motivated the original redesign request.

This is a genuinely different, larger piece of work than the token pass — it changes markup structure, not just appearance, so it will also require updating the existing Playwright specs that currently query table structure (`tests/tickets.spec.ts`, `tests/users.spec.ts` at minimum — confirmed via grep for `tbody tr`/table selectors).

## Decisions confirmed with the user

- **Scope**: `Tickets.tsx`, `Users.tsx`, `Clients.tsx` all switch to cards. `TicketDetail`/ticket detail page is unaffected (it's not a list).
- **Full replacement, no table/card toggle** — cards become the only view for these three pages (unlike the customer portal's `PortalTickets.tsx`, which keeps its existing grid/list toggle — that page is out of scope here).
- Login pages remain untouched (same standing constraint as the prior redesign).

## User Stories

1. **As an agent/admin working the ticket queue**, I want to scan tickets as cards (title, status, priority, assignee, client, last-active at a glance) instead of a dense table row, so triaging feels closer to a modern helpdesk product.
2. **As an admin managing users**, I want to see each user's role/status/actions as a card, consistent with the rest of the app's new card-based language.
3. **As an admin managing clients**, I want the client list in the same card style, so the whole admin section feels visually unified.
4. **As an agent/admin**, I still need all current functionality — filtering, sorting, search, pagination, row actions (edit/deactivate/delete, assign, view) — just presented as cards instead of table rows. No functional regression.

## Acceptance Criteria

- `Tickets.tsx`, `Users.tsx`, `Clients.tsx` render their data as a responsive card grid (not an HTML `<table>`).
- All existing filters, search, sort controls, and pagination remain present and functional, adapted to sit above/around the card grid instead of a table header row.
- All existing row-level actions (view ticket, edit user, deactivate/activate/delete user, copy portal link/view tickets for a client, etc.) are present on each card.
- Empty/loading/error states use the shared `EmptyState`/`ErrorBanner`/`Skeleton` components already introduced in the prior redesign pass, adapted to a card-grid skeleton shape instead of table-row skeletons.
- Status/priority/type colors continue to use the shared `STATUS_CONFIG`/`PRIORITY_CONFIG`/`TYPE_CONFIG` tokens from `client/src/lib/status-config.ts` (no new color systems introduced).
- Responsive: cards reflow into fewer columns on narrower viewports (this replaces the existing separate mobile-card-vs-desktop-table branching already present in `Tickets.tsx` — that branch collapses since cards are now the only view at every width).
- `tests/tickets.spec.ts` and `tests/users.spec.ts` (and any other spec relying on table markup for these three pages) are updated to match the new card markup, and continue to assert the same underlying behavior (data shown, actions work, filters work) — not just updated to pass superficially.
- `npx playwright test` and `npx vitest run` pass after the change.

## Technical Specs

- New shared component likely needed: a `TicketCard`/generic list-card treatment per page (these three pages show different data shapes, so likely three page-specific card components rather than one generic card, reusing the shared `Badge`/`STATUS_CONFIG`/`PRIORITY_CONFIG` primitives for consistent status/priority rendering).
- Files touched: `client/src/pages/Tickets.tsx`, `client/src/pages/Users.tsx`, `client/src/pages/Clients.tsx`, plus their test coverage in `tests/tickets.spec.ts`, `tests/users.spec.ts` (and `client/src/pages/Tickets.test.tsx` unit test if it asserts table structure — needs checking).
- `Tickets.tsx` already has a mobile card-view branch (separate from its desktop table) — that existing mobile card markup is a useful starting reference for the new unified card design, though it likely needs restyling to carry the extra detail a desktop card should show (a mobile card currently omits fields a table column would show).
- No backend/API changes — this is presentation-layer only, same data shapes.
