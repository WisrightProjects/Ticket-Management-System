# Tech Stack

## Runtime

- **Bun** — JavaScript/TypeScript runtime and package manager

## Frontend

- **React.js** (v19) — UI framework
- **TypeScript** — type safety
- **Tailwind CSS** (v4) — utility-first styling
- **shadcn/ui** — component library (Button, Card, Input, Label)
- **React Router DOM** (v7) — client-side routing
- **React Hook Form** — form state management
- **Zod** — schema validation
- **Vite** (v8) — build tool and dev server

## Backend

- **Node.js** — runtime
- **Express.js** (v5) — web framework
- **TypeScript** — type safety
- **Helmet** — security headers middleware
- **express-rate-limit** — rate limiting (production only)

## Database

- **PostgreSQL** (v17, port 5433) — primary database
- **Prisma** (v7) — ORM and database migrations
- **@prisma/adapter-pg** — PostgreSQL adapter for Prisma v7

## Authentication

- **Better Auth** (v1.5) — email/password auth with database sessions
- Sign-up disabled (admin creates users)
- Session-based (7-day expiry, daily refresh)
- Min password length: 8 characters

## Security

- **Helmet** — HTTP security headers (CSP, X-Frame-Options, etc.)
- **Rate Limiting** — 20 login attempts per 15 min (production only)
- **CORS** — restricted to client origin
- **Body Size Limit** — 50kb max request body

## Testing

- **Playwright** — end-to-end browser testing
- Separate test database (`ticket_management_test`)
- Global setup/teardown for test data isolation

## Deployment

- **Docker** — containerized application
- **Coolify** — self-hosted deployment platform
