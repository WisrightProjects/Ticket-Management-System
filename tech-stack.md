# Tech Stack

## Runtime

- **Bun** — JavaScript/TypeScript runtime and package manager (monorepo workspaces)

## Frontend

- **React.js** (v19) — UI framework
- **TypeScript** (v5.9) — type safety
- **Tailwind CSS** (v4) — utility-first styling
- **shadcn/ui** — component library built on `@base-ui/react` (Button, Card, Input, Label, Badge, Dialog, Select, Table, Skeleton)
- **React Router DOM** (v7) — client-side routing with ProtectedRoute, AdminRoute, GuestRoute
- **TanStack Query** (v5) — server state, caching, mutations
- **React Hook Form** (v7) — form state management
- **Zod** (v4) — schema validation
- **Vite** (v8) — build tool and dev server

## Backend

- **Express.js** (v5) — web framework with automatic async error handling
- **TypeScript** — type safety
- **Helmet** — security headers middleware
- **express-rate-limit** — rate limiting (500 req/15min dev, 100 req/15min prod)
- **CORS** — restricted to `CLIENT_URL`
- **dotenv** — environment variable loading

## Shared

- **`@tms/core`** — internal workspace package
  - Zod schemas: `createUserSchema`, `editUserSchema`, `apiUserSchema`
  - Constants: `ROLES`, `USER_ROLES`
  - Types: `UserRole`, `ApiUser`, `CreateUserInput`, `EditUserInput`

## Database

- **PostgreSQL** (v17, port 5433) — primary database
- **Prisma** (v7) — ORM and database migrations with custom output path
- **`@prisma/adapter-pg`** — PostgreSQL driver adapter for Prisma v7
- **`pg`** — PostgreSQL client (connection pool)

## Authentication

- **Better Auth** (v1.5) — email/password auth with database sessions
  - Sign-up disabled (admin creates users only)
  - Session-based (7-day expiry, daily refresh)
  - Credentials stored on `Account` model (separate from `User`)
  - Auth routes bypass Express middleware via `http.createServer`

## Security

- **Helmet** — HTTP security headers (CSP, X-Frame-Options, HSTS, etc.)
- **Rate Limiting** — `express-rate-limit` on all `/api` routes
- **CORS** — restricted to client origin via `CLIENT_URL` env var
- **Body Size Limit** — 50kb max request body
- **Zod validation** — all API inputs validated with `safeParse` on server
- **Atomic user creation** — `prisma.$transaction` for user + account creation
- **Password hashing** — `better-auth/crypto` `hashPassword`
- **Global JSON error handler** — all Express errors returned as JSON (no HTML pages)

## Testing

### Unit Tests

- **Vitest** (v4) — test runner
- **@testing-library/react** (v16) — component rendering
- **@testing-library/user-event** (v14) — user interaction simulation
- **@testing-library/jest-dom** (v6) — DOM matchers
- **jsdom** — browser environment for tests
- 12 tests covering the create user form (validation, submit, server errors)

### E2E Tests

- **Playwright** — end-to-end browser testing (Chromium)
- Separate test database (`ticket_management_test`)
- Global setup: migrations + admin seed before each run
- Global teardown: all tables truncated after tests complete
- 56 tests across authentication (47) and user management (9)

## Deployment (Planned)

- **Docker** — containerized application
- **Coolify** — self-hosted deployment platform
