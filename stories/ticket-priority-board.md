# Ticket Priority Board (Kanban)

## Overview

Following the card-grid conversion, the user wants the Tickets page to go further: a Zoho Desk-style kanban board, grouping tickets into columns by priority instead of one flat filtered/sorted/paginated grid. This is a full replacement of the current flat grid (confirmed with the user — no grid/board toggle).

## Decisions confirmed with the user

- **Full replacement** of the current flat card grid + "Sort by" dropdown + pagination footer.
- **4 columns**, one per existing priority value: Critical, High, Medium, Low (not folded into 3 to match the reference image — the app's real data model has 4 priorities).
- Card content/visual design is unchanged (reuse the existing `TicketCard` built in the last pass) — only the layout around it changes.

## User Stories

1. **As an agent/admin**, I want to see tickets grouped into Critical/High/Medium/Low columns at a glance, so I can immediately see where the urgent work is without scanning a long flat list.
2. **As an agent/admin**, I still want to filter (search, status, category, client, assignee, date range) and control ticket order within each column — just not by priority, since priority is now the column axis itself.
3. **As an agent/admin working a queue with more tickets than fit on screen**, I want each column to load more tickets on demand (not silently cap or hide tickets), so the board stays accurate as the queue grows.

## Acceptance Criteria

- Tickets page renders 4 columns (Critical, High, Medium, Low), each with a header showing the priority label and an accurate total count for that priority under the current filters.
- Existing filters (search, status, category/type, client, assignee, date range, and the type tabs All/Bugs & Support/New Requirements/Reopened) still apply, narrowing which tickets appear across all 4 columns.
- The priority filter dropdown is removed from the filter bar (redundant — priority is now the column axis).
- The existing sort control (field + direction) still applies, governing ticket order **within** each column.
- Each column fetches and paginates independently (a "Load more" affordance per column) rather than one global page size — no ticket is ever silently hidden by a shared cap.
- Card content, click-to-navigate, and the Eye "quick view" action are unchanged from the current `TicketCard`.
- Loading skeletons, empty states ("No {priority} tickets"), and the error banner all work per-column.
- Explicitly out of scope for this pass: drag-and-drop between columns to change a ticket's priority. Columns are read/filter-only for now — this can be a follow-up if wanted later.
- `client/src/pages/Tickets.test.tsx` and `tests/tickets.spec.ts` are updated to match the new column-based structure.

## Technical Specs

- File touched: `client/src/pages/Tickets.tsx` only (no backend/API shape changes — reuses the existing `GET /api/tickets` endpoint with a `priority` query param, called once per column).
- Replace the single `useQuery(["tickets", ...])` with 4 parallel `useQuery` calls (one per priority value), each with its own `pageIndex`/pageSize state for "Load more" pagination, all sharing the same filter/sort inputs except `priority` (fixed per column).
- Board container: horizontally-scrollable row of 4 columns, each independently vertically scrollable, sticky column header (label + count).
