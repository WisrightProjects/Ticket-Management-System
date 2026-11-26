# Professional UI Redesign

## Overview

Right Tracker's in-app UI (everything after login) is visually inconsistent — colors, spacing, and card/table styling vary page to page because most pages use ad-hoc inline styles or one-off Tailwind classes instead of a shared design system. Compared to reference products like Zoho Desk, Zendesk, and Freshdesk, it reads as an internal tool rather than a polished product.

This redesign introduces a single, consistent design system across the staff app and customer portal — consistent spacing scale, typography, card/table treatments, and a coherent color system (status/priority/type badges, buttons, empty/loading states) — without touching the branded login screens.

**Explicit exclusion (per user instruction):** `client/src/pages/Login.tsx`, `client/src/pages/portal/PortalLogin.tsx`, `client/src/pages/portal/PortalForgotPassword.tsx`, and `client/src/pages/portal/PortalResetPassword.tsx` keep their current black/red/gold branded-panel color theme exactly as-is. These four pages use fully hardcoded inline styles (not the shared CSS tokens), so excluding them from the token/component changes below leaves them untouched by construction — no special-casing needed, just: don't edit these files' visual styling.

## User Stories

1. **As an internal agent or admin**, I want a clean, information-dense, consistent workspace (dashboard, ticket list, ticket detail, analytics, user/client management), so I can triage and work tickets efficiently without visual clutter or per-page inconsistency.
2. **As a client using the portal**, I want the post-login portal experience (dashboard, ticket list, ticket detail, submit form) to look as polished as tools like Zoho Desk or Freshdesk, so I trust WisRight as a professional software vendor.
3. **As anyone using either surface**, I want status, priority, and ticket-type always communicated the same way (consistent badge colors/shapes) everywhere they appear, so I never have to relearn what a badge means from page to page.
4. **As anyone using either surface**, I want clear, well-designed empty/loading/error states, so the product never feels broken when there's no data yet.
5. **As a user landing on the login screens**, I want them to look exactly as they do today — the branded black/red/gold panel is intentional and out of scope here.

## Acceptance Criteria

- `client/src/index.css` design tokens (`--rt-*`, status/priority/type badge tokens) become the single source of color/spacing/radius truth for every in-app page — no page introduces a new hardcoded hex color outside that token set.
- `Login.tsx`, `PortalLogin.tsx`, `PortalForgotPassword.tsx`, `PortalResetPassword.tsx` are **not modified** in this change — verified by diff review before considering the work done.
- Consistent card, table, and badge styling applied across: `Dashboard`, `Tickets`, `TicketDetail` + `TicketMetaSidebar` + `TicketReplies` + `TicketSlidePanel`, `Analytics`, `Users`, `Clients`, `AgentDetail`, internal-ticket pages, `PortalDashboard`, `PortalTickets`, `PortalTicketDetail`, `PortalSubmit`, `Portal404`.
- `Navbar`, `Sidebar`, `AppLayout` (staff) and `PortalLayout` (customer) get a cleaner, more consistent shell treatment (spacing, active-state styling, typography hierarchy).
- Existing status/priority/type badge color mappings (`status-config.ts`, `ticket-badges.ts`) are kept functionally equivalent (same enum → same distinguishable color) but visually tightened/normalized as part of the shared token system.
- No behavior change — this is a visual/styling pass only. All existing Playwright specs must keep passing unmodified (selectors based on text/role, not styling, per current test patterns) since this changes appearance, not functionality.
- Responsive behavior (mobile sidebar collapse, table overflow, etc.) is preserved or improved, not regressed.

## Technical Specs

- **Design tokens**: `client/src/index.css` — refine `--rt-bg/surface/border/text-*` tokens toward a neutral slate palette (dropping the current red-tinted background `#fff9f9`) and normalize badge tokens (status/priority/type) for clearer visual hierarchy. **Accent color decision (confirmed with user):** keep the primary in-app accent as a muted/deeper brand red (not today's alarm-red `#CC0000` used everywhere), and reserve a distinct, brighter red strictly for errors, destructive actions, and CRITICAL priority — so brand and "something's wrong" are visually distinguishable for the first time. This preserves color continuity with the excluded login screens while fixing the actual problem (one red doing every job).
- **Shared style helpers**: `client/src/lib/status-config.ts`, `client/src/lib/ticket-badges.ts` — adjust only if token changes require it; keep exported shapes stable so consuming components don't need logic changes.
- **Layout shells**: `client/src/components/AppLayout.tsx`, `Navbar.tsx`, `Sidebar.tsx`, `client/src/pages/portal/PortalLayout.tsx`.
- **Staff pages**: `Dashboard.tsx`, `Tickets.tsx`, `TicketDetail.tsx`, `TicketMetaSidebar.tsx`, `TicketReplies.tsx`, `TicketSlidePanel.tsx`, `Analytics.tsx`, `Users.tsx`, `Clients.tsx`, `AgentDetail.tsx`, internal-ticket pages.
- **Portal pages**: `PortalDashboard.tsx`, `PortalTickets.tsx`, `PortalTicketDetail.tsx`, `PortalSubmit.tsx`, `Portal404.tsx`.
- **Out of scope**: `Login.tsx`, `PortalLogin.tsx`, `PortalForgotPassword.tsx`, `PortalResetPassword.tsx` (branding), any backend/API changes, any new features or data-shape changes.
