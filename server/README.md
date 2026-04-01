# Server — Express.js Backend

Express.js 5 + TypeScript backend for the Ticket Management System.

## Stack

| Tool | Purpose |
|:-----|:--------|
| Bun | Runtime and package manager |
| Express.js 5 | Web framework |
| TypeScript | Type safety |
| Prisma 7 | ORM and migrations (custom output path) |
| `@prisma/adapter-pg` | PostgreSQL driver adapter |
| Better Auth 1.5 | Email/password auth, database sessions |
| Helmet | HTTP security headers |
| express-rate-limit | Rate limiting |
| Zod (via `@tms/core`) | Input validation on all routes |

## Scripts

```bash
# Development (with file watching)
bun --watch src/index.ts

# Run once
bun run src/index.ts

# Generate Prisma client
bunx prisma generate

# Run migrations
bunx prisma migrate deploy

# Seed database
bun run prisma/seed.ts
```

## Project structure

```
src/
├── generated/
│   └── prisma/              # Prisma-generated client (custom output path)
├── lib/
│   ├── auth.ts              # Better Auth configuration
│   └── prisma.ts            # Prisma client with @prisma/adapter-pg
├── middleware/
│   └── auth.ts              # requireAuth + requireAdmin middleware
├── routes/
│   ├── users.ts             # GET/POST/PUT/PATCH /api/users
│   ├── tickets.ts           # GET /api/tickets, GET /api/tickets/:id
│   └── webhooks.ts          # POST /api/webhooks/email
└── index.ts                 # Express app, rate limiting, HTTP server
prisma/
├── schema.prisma            # Database schema
├── migrations/              # SQL migration files
└── seed.ts                  # Seeds default admin user
```

## Environment variables

| Variable | Description |
|:---------|:------------|
| `PORT` | Server port (default: `4000`) |
| `DATABASE_URL` | PostgreSQL connection string |
| `BETTER_AUTH_SECRET` | Secret key (min 32 chars) |
| `BETTER_AUTH_URL` | Backend base URL (e.g. `http://localhost:4000`) |
| `CLIENT_URL` | Frontend origin for CORS (e.g. `http://localhost:5173`) |
| `NODE_ENV` | `development` or `production` |
| `TEST_BACKEND_URL` | Backend URL used by Playwright tests (e.g. `http://localhost:5001`) |
| `WEBHOOK_SECRET` | Optional secret to guard `POST /api/webhooks/*` (leave blank to disable) |
| `ADMIN_EMAIL` | Seed admin email |
| `ADMIN_PASSWORD` | Seed admin password |

Copy `.env.example` to `.env` to get started.

## API routes

| Method | Path | Auth | Description |
|:-------|:-----|:-----|:------------|
| `GET` | `/api/health` | None | Health check |
| `POST` | `/api/auth/sign-in/email` | None | Login |
| `POST` | `/api/auth/sign-out` | Session | Logout |
| `GET` | `/api/auth/get-session` | None | Current session |
| `GET` | `/api/users` | Admin | List all users |
| `POST` | `/api/users` | Admin | Create user |
| `PUT` | `/api/users/:id` | Admin | Update user |
| `PATCH` | `/api/users/:id/status` | Admin | Toggle active status |
| `GET` | `/api/tickets` | Session | List tickets (sort/filter/paginate via query params) |
| `GET` | `/api/tickets/:id` | Session | Get single ticket by ticketId (e.g. `TKT-0001`) |
| `POST` | `/api/webhooks/email` | Optional secret | Create ticket from inbound email payload |

## Notes

- Auth routes (`/api/auth/*`) are handled by Better Auth directly via `http.createServer` — they bypass Express middleware entirely.
- Prisma client is generated to `src/generated/prisma/` (not the default `@prisma/client` path). Always import from `"../generated/prisma/client.js"`.
- Rate limiting: 500 req/15min in development, 100 req/15min in production.
