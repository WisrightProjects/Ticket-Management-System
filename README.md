# Right Tracker — WisRight Support Tool

An internal ticket management system and customer portal built for WisRight. Agents and admins manage support tickets through a full-featured dashboard; customers submit and track tickets via a branded public portal.

**Repository:** https://github.com/Yuvaraj-3007/Ticket-Management-System

---

## Table of Contents

- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Setup](#setup)
- [Environment Variables](#environment-variables)
- [Features](#features)
- [Testing](#testing)
- [Scripts](#scripts)

---

## Tech Stack

| Layer | Technology |
|:------|:-----------|
| Runtime | Bun 1.3.11 |
| Frontend | React 19, TypeScript 5.9, Vite 8 |
| Styling | Tailwind CSS 4, shadcn/ui |
| Data fetching | TanStack Query v5 |
| Tables | TanStack Table v8 |
| Forms | React Hook Form 7 + Zod 4 |
| Routing | React Router 7 |
| Charts | Recharts |
| HTTP client | Axios |
| Backend | Express.js 5, TypeScript |
| Auth | Better Auth 1.5 |
| ORM | Prisma 7 with @prisma/adapter-pg |
| Database | PostgreSQL 17 |
| Shared package | @tms/core (Zod schemas, role/status constants) |
| AI | Kimi (Moonshot AI) via Vercel AI SDK |
| Job queue | pg-boss v12 |
| Monitoring | Sentry (@sentry/node) |
| Tests (unit) | Vitest |
| Tests (e2e) | Playwright |

---

## Project Structure

```
.
├── client/                  # React frontend (Vite, port 5173)
│   └── src/
│       ├── components/      # Reusable UI components (EnumSelect, TicketReplies, etc.)
│       ├── pages/           # Route-level page components
│       ├── hooks/           # Custom React hooks
│       └── lib/             # Axios instance, query client, utilities
├── server/                  # Express backend (Bun, port 4000)
│   ├── src/
│   │   ├── routes/          # Express route handlers
│   │   ├── workers/         # pg-boss job workers (classify, auto-resolve)
│   │   ├── lib/             # Auth, email, AI, CAPTCHA utilities
│   │   └── generated/       # Prisma client output (server/src/generated/prisma/)
│   └── prisma/
│       ├── schema.prisma
│       ├── migrations/
│       └── seed.ts
├── packages/
│   └── core/                # Shared @tms/core workspace package
│       └── src/             # Zod schemas, ROLES, STATUS constants
├── tests/                   # Playwright e2e test suites
│   ├── auth.spec.ts
│   ├── users.spec.ts
│   ├── tickets.spec.ts
│   ├── ticket-detail.spec.ts
│   ├── dashboard.spec.ts
│   ├── portal.spec.ts
│   ├── webhooks.spec.ts
│   ├── frontend-features.spec.ts
│   ├── global-setup.ts
│   └── global-teardown.ts
├── CLAUDE.md                # Coding guidelines
├── package.json             # Workspace root
└── playwright.config.ts
```

---

## Prerequisites

- **Bun** 1.3 or later — https://bun.sh
- **PostgreSQL** 17 running on port **5433**
- **Node.js** 20 or later (required by some tooling)

---

## Setup

### 1. Clone the repository

```bash
git clone https://github.com/Yuvaraj-3007/Ticket-Management-System.git
cd Ticket-Management-System
```

### 2. Install dependencies

```bash
bun install
```

This installs dependencies for all workspaces (`client/`, `server/`, `packages/core/`) in one pass.

### 3. Configure environment variables

Create `server/.env` and populate it with the values described in the [Environment Variables](#environment-variables) section. At minimum, `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, and `CLIENT_URL` are required to start the server.

### 4. Run database migrations

```bash
cd server
bunx prisma migrate deploy
```

### 5. Seed the database

```bash
# from server/
bun run prisma/seed.ts
```

This creates the default admin account and required reference data.

**Default admin credentials:**

| Email | Password |
|:------|:---------|
| `admin@wisright.com` | `Test@123` |

> Sign-up is disabled for internal users. Only admins can create new accounts via the User Management page.

### 6. Start the backend

```bash
# from server/
bun run src/index.ts
```

The API server starts on **http://localhost:4000**.

### 7. Start the frontend

```bash
# from client/
bun run dev
```

The dev server starts on **http://localhost:5173**.

---

## Environment Variables

All variables go in `server/.env`. Variables marked **required** must be present for the server to start correctly.

| Variable | Description | Required |
|:---------|:------------|:--------:|
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `BETTER_AUTH_SECRET` | Session signing secret | Yes |
| `BETTER_AUTH_URL` | Backend base URL (e.g. `http://localhost:4000`) | Yes |
| `CLIENT_URL` | Frontend origin for CORS (e.g. `http://localhost:5173`) | Yes |
| `CAPTCHA_SECRET` | CAPTCHA token signing key (falls back to `BETTER_AUTH_SECRET`) | No |
| `WEBHOOK_SECRET` | Guards `POST /api/webhooks/*` — required in production | Prod |
| `PORT` | HTTP listen port (default: `4000`) | No |
| `MOONSHOT_API_KEY` | Kimi AI — ticket classify, polish, summarize, auto-resolve | No |
| `SENTRY_DSN` | Sentry error reporting DSN | No |
| `GMAIL_USER` | Outbound SMTP address (e.g. `wisright.support@gmail.com`) | No |
| `GMAIL_APP_PASSWORD` | Gmail App Password for SMTP | No |
| `GOOGLE_CLIENT_ID` | Google OAuth2 client ID (Gmail API inbound) | No |
| `GOOGLE_CLIENT_SECRET` | Google OAuth2 client secret | No |
| `GOOGLE_REFRESH_TOKEN` | OAuth2 refresh token for Gmail API | No |
| `GMAIL_PUBSUB_TOPIC` | GCP Pub/Sub topic for Gmail push notifications | No |
| `GMAIL_PUBSUB_SECRET` | GCP Pub/Sub push verification secret | No |
| `HRMS_API_URL` | HRMS-POC base URL (customer/employee data source) | No |
| `HRMS_API_KEY` | HRMS-POC API key | No |

---

## Features

### Authentication and User Management

- Email/password login via Better Auth (self sign-up is disabled for internal users)
- Role-based access control: **ADMIN**, **AGENT**, **CUSTOMER**
- Secure session cookies: `httpOnly`, `SameSite=Lax`
- Admin user list with name search and 10-per-page pagination
- Create, edit, and delete users; deleting an agent cascades ticket reassignment to the acting admin
- Activate and deactivate accounts
- Show/hide password toggle in the edit dialog

### Agent Performance Page (`/users/:id`)

- KPI cards: Total Assigned, Total Closed, Average Resolution Time, Average Rating
- Recharts visualisations: tickets by Status, Priority, Type, Project, and 30-day monthly trend
- Recent Tickets table showing the last 30 tickets
- CSV export and print report (print-safe CSS hides navigation chrome)

### Ticket Management

- Sortable, filterable, paginated ticket list
- Six-stage status workflow: `UN_ASSIGNED` → `OPEN_NOT_STARTED` → `OPEN_IN_PROGRESS` → `OPEN_QA` → `OPEN_DONE` → `CLOSED`
- Inline editing for status, type, priority, and assignee
- AI features (requires `MOONSHOT_API_KEY`):
  - Reply polish — Kimi rewrites a draft reply for clarity and professionalism
  - Ticket summarisation — Kimi produces a concise summary of the full thread
  - Auto-classify worker — sets type and priority on newly created tickets
  - Auto-resolve worker — KB lookup; resolves to `OPEN_DONE` with an AI-generated reply, or falls back to `OPEN_NOT_STARTED`
- Threaded comments with `AGENT` / `CUSTOMER` sender types (derived server-side; clients cannot forge sender)
- Image attachments: up to 5 files, 1 MB each, JPEG/PNG/GIF/WEBP

### Customer Portal (`/portal/:slug`)

- Branded portal per company slug (e.g. `/portal/skanska-ab`)
- Public ticket submission form with server-side CAPTCHA
  - SVG image CAPTCHA — no plaintext code exposed to the client
  - 3-part encrypted token (`ts.encryptedCode.hmac`), single-use, 10-minute expiry
- Customer sign-up and sign-in
- My Tickets: list and grid view, status filter, 10-per-page pagination
- Ticket detail with full reply thread (sortable oldest/newest)
- 1–5 star rating for closed tickets

### Email Integration

- **Inbound:** Google Pub/Sub push notification → Gmail API fetches unread messages → creates a new ticket or appends a reply to an existing thread
- **Outbound:** Gmail SMTP via nodemailer — auto-replies to customers when an agent posts a comment
- **Reply threading:** detects a `Ticket: TKT-XXXX` footer in the email body to link replies to the correct ticket

### Analytics Dashboard

- Stat cards: total tickets, open tickets, AI-resolved count and percentage, average resolution time
- 30-day daily ticket volume bar chart (Recharts)

### Security

- `helmet()` headers and CORS locked to `CLIENT_URL`
- Rate limiting on general, ticket-submit, and CAPTCHA endpoints
- Webhook secret enforcement in non-test environments
- `isActive` guard on every authenticated route
- Request body size limit: 50 KB
- Per-user AI rate limit: 10 requests per minute
- Prompt injection mitigation: XML delimiters isolate user-supplied content in AI prompts; `</draft>` tags are stripped before polish calls; comment threads are capped at 6,000 characters in summarize
- Sentry error reporting with sanitised error logging (no internal stack traces leaked to clients)

---

## Testing

### Unit Tests (Vitest)

Run from `client/`:

```bash
bun run test:components
```

133 component and utility tests covering UI logic, form validation, and helper functions.

### End-to-End Tests (Playwright)

Run from the repo root:

```bash
bunx playwright test
```

Playwright uses a separate test database (`ticket_management_test`). Global setup runs migrations and seeds the DB; teardown truncates all tables between runs.

- Test backend: port **5001**
- Test frontend: port **5174**

| Suite | Coverage |
|:------|:---------|
| `auth.spec.ts` | Login, logout, session handling, CAPTCHA |
| `users.spec.ts` | User CRUD, pagination, search, role management |
| `tickets.spec.ts` | Ticket list, filters, sorting, creation |
| `ticket-detail.spec.ts` | Ticket detail view, replies, status transitions |
| `dashboard.spec.ts` | Analytics cards and charts |
| `portal.spec.ts` | Customer portal submit, sign-up, My Tickets, rating |
| `webhooks.spec.ts` | Inbound webhook auth and ticket creation |
| `frontend-features.spec.ts` | Cross-cutting UI interactions |

To run a single suite:

```bash
bunx playwright test tests/portal.spec.ts
```

To open the interactive UI:

```bash
bunx playwright test --ui
```

---

## Scripts

| Command | Run from | Description |
|:--------|:---------|:------------|
| `bun install` | root | Install all workspace dependencies |
| `bun run src/index.ts` | `server/` | Start the backend server (port 4000) |
| `bun run dev` | `client/` | Start the frontend dev server (port 5173) |
| `bunx prisma migrate deploy` | `server/` | Apply pending database migrations |
| `bun run prisma/seed.ts` | `server/` | Seed the database with initial data |
| `bunx playwright test` | root | Run all Playwright e2e tests |
| `bun run test:components` | `client/` | Run Vitest unit tests |
| `bun run scripts/cleanup-spam.ts` | `server/` | Remove spam tickets by sender domain |

---

## Ports Reference

| Service | Port |
|:--------|:-----|
| Backend (dev) | 4000 |
| Frontend (dev) | 5173 |
| Backend (test) | 5001 |
| Frontend (test) | 5174 |
| HRMS-POC (NestJS) | 3000 |
| PostgreSQL | 5433 |
