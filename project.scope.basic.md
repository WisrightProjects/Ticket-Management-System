# Project Scope: Basic Ticket Management System (Phase 1)

## 1. Problem

We are a SaaS and product development company. Currently all client requirements, bugs, and tasks come through Email, WhatsApp, and Teams with no proper tracking. Tickets get lost, no one knows the status, and there is zero accountability.

## 2. Goal

Build a **simple, internal web-based ticket management system** where team members can create, assign, track, and close tickets in one place.

> **No integrations. No automation. No client portal. Just a clean, working ticket system first.**

---

## 3. Core Features

### 3.1 Authentication

- Login / Logout (email + password)
- Basic role: **Admin** and **Agent**
- Admin can manage users
- Agent can create and work on tickets

### 3.2 Ticket Management

\
- Create a ticket with:
  - Title
  - Description
  - Type (Bug / Requirement / Task / Support)
  - Priority (Low / Medium / High / Critical)
  - Assigned To (select a team member)
  - Project name (simple text or dropdown)
  - Attachments (files / screenshots)
- Auto-generated Ticket ID (e.g., TKT-0001)
- Status flow: **Open → In Progress → Resolved → Closed**
- Edit ticket details
- Add comments on a ticket (internal team discussion)
- View ticket history (who changed what, when)

### 3.3 Dashboard

- Total tickets by status (Open, In Progress, Resolved, Closed)
- Recent tickets list
- Filter tickets by status, priority, type, assigned person, project
- Search tickets by title or ticket ID

### 3.4 My Tickets

- Each user sees tickets assigned to them
- Quick filters: Open / In Progress / Resolved

### 3.5 User Management (Admin only)

- Add / edit / deactivate users
- Assign role (Admin or Agent)

---

## 4. What This System Will NOT Have (Phase 1)

- No email / WhatsApp / Teams integration
- No auto-assignment or workflow engine
- No SLA tracking
- No client portal
- No notifications (email/push) — just in-app status
- No reporting/analytics dashboards
- No API for external systems
- No multi-tenancy

---

## 5. User Roles

| Role  | Can Do                                                    |
| ----- | --------------------------------------------------------- |
| Admin | Everything + manage users, manage projects                |
| Agent | Create tickets, update assigned tickets, add comments     |

---

## 6. Pages / Screens

1. **Login page**
2. **Dashboard** — ticket summary + recent tickets
3. **Ticket list** — filterable, searchable table of all tickets
4. **Create ticket** — form to raise a new ticket
5. **Ticket detail** — view full ticket, comments, history, edit status
6. **My Tickets** — tickets assigned to logged-in user
7. **User management** (Admin) — add/edit users

---

## 7. Tech Stack

| Layer     | Technology                                         |
| --------- | -------------------------------------------------- |
| Runtime   | Bun                                                |
| Frontend  | React 19 + TypeScript + Vite + Tailwind CSS v4     |
| Backend   | Express.js 5 + TypeScript                          |
| Database  | PostgreSQL 17                                      |
| ORM       | Prisma 7 with `@prisma/adapter-pg`                 |
| Auth      | Better Auth 1.5 (email/password, database sessions)|
| Shared    | `@tms/core` workspace package (Zod schemas, ROLES) |
| Testing   | Playwright (E2E, 124 tests) + Vitest (unit, 12 tests)|
| Hosting   | Docker + Coolify (self-hosted)                     |

---

## 8. Success Criteria

- Team can create and track tickets from a single dashboard
- No more lost requirements
- Everyone knows what is assigned to them
- Admin has visibility into all open work
