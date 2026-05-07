# Story: Ticket UX & WiseWork Integration Improvements

## Epic
Improve the ticket management experience across Right Tracker (TMS) and WiseWork (HRMS-POC) to make both platforms more professional and better connected.

---

## Story 1 — Full-screen ticket detail page

**As an** admin or agent,
**I want** the ticket detail page to use the full available width,
**So that** I can see all ticket information without unnecessary scrolling or cramped layouts.

### Acceptance Criteria
- [ ] Opening a ticket at `/tickets/:id` fills the full content area (no `max-w-4xl` centering)
- [ ] The page uses a two-column layout: left column shows header, description, and replies; right column shows a sticky metadata sidebar (status, priority, assignee, project, hours, etc.)
- [ ] The layout is responsive — on smaller screens the columns stack vertically
- [ ] The "Back to Tickets" button is present at the top

---

## Story 2 — Remove duplicate customer message from REPLIES

**As an** admin or agent,
**I want** the REPLIES section to show only actual replies (agent and customer follow-ups),
**So that** I don't see the original ticket description duplicated at the top of the replies list.

### Acceptance Criteria
- [ ] The REPLIES section does NOT render the original customer message block (the blue-background description repeat)
- [ ] DESCRIPTION section above still shows the original message as before
- [ ] Subsequent customer replies (from comments API) still show with the Customer badge and blue background
- [ ] The reply count `(N)` still reflects actual reply count

---

## Story 3 — Admin sidebar: remove "My Tickets", add "Raise Ticket"

**As an** admin,
**I want** "My Tickets" removed from my sidebar navigation,
**So that** my sidebar is clean and focused on admin-level actions.

**And I want** a "Raise Ticket" shortcut in the sidebar,
**So that** I can quickly submit an internal ticket when needed.

### Acceptance Criteria
- [ ] When logged in as ADMIN: "My Tickets" nav item is NOT visible in the sidebar
- [ ] When logged in as ADMIN: "Raise Ticket" nav item IS visible and navigates to `/internal/submit`
- [ ] When logged in as AGENT: "My Tickets" nav item IS still visible and navigates to `/internal/tickets`
- [ ] "Raise Ticket" is NOT shown to agents (they already have "My Tickets" → "New Ticket" button)

---

## Story 4 — WiseWork: full ticket detail page for assigned tickets

**As a** WiseWork employee (developer/agent),
**I want** to click on an assigned ticket and open a full detail page inside WiseWork,
**So that** I can read the ticket details without leaving the WiseWork application.

### Acceptance Criteria
- [ ] My Tickets page (`/user/tickets`) shows all tickets assigned to me
- [ ] Clicking a ticket row navigates to `/user/tickets/:id` — a dedicated ticket detail page within WiseWork
- [ ] The detail page shows: Ticket ID, Title, Priority, Status, Description, Assigned By, Date
- [ ] An "Open in Right Tracker" button opens the original ticket URL in a new browser tab
- [ ] A real-time toast overlay appears when a new ticket is assigned (auto-dismisses after 30s)
- [ ] Clicking "View Ticket" on the overlay navigates to the My Tickets page

---

## Story 5 — WiseWork: admin can see all employees' tickets

**As a** WiseWork admin/manager,
**I want** to see ALL ticket assignments across all employees in my organisation,
**So that** I can monitor workload distribution and support my team.

### Acceptance Criteria
- [ ] When logged in as admin/manager, the My Tickets page has an "All Tickets" tab
- [ ] "All Tickets" tab shows every TICKET_ASSIGNED notification for the tenant, including employee name
- [ ] Employees only see their own tickets (no "All Tickets" tab)

---

## Out of Scope (future stories)
- Developer replying to tickets from WiseWork with sync back to Right Tracker
- Developer updating ticket status from WiseWork with sync to Right Tracker
- WiseWork-internal ticket creation (without Right Tracker)
