# Client — React Frontend

React 19 + Vite 8 + TypeScript frontend for the Ticket Management System.

## Stack

| Tool | Purpose |
|:-----|:--------|
| React 19 | UI framework |
| Vite 8 | Dev server and build tool |
| TypeScript 5.9 | Type safety |
| Tailwind CSS 4 | Styling |
| shadcn/ui (Base UI) | Component library |
| React Router DOM 7 | Client-side routing |
| TanStack Query v5 | Server state and caching |
| React Hook Form 7 | Form state management |
| Zod 4 | Schema validation |
| `@tms/core` | Shared schemas and ROLES constants |

## Scripts

```bash
# Development server (port 5173)
bun run dev

# Type check + build
bun run build

# Lint
bun run lint

# Unit tests (run once)
bun run test:components

# Unit tests (watch mode)
bun run test:components:watch
```

## Project structure

```
src/
├── components/
│   ├── Navbar.tsx              # Top navigation bar
│   └── ui/                     # shadcn/ui components
│       ├── badge.tsx
│       ├── button.tsx
│       ├── dialog.tsx
│       ├── input.tsx
│       ├── label.tsx
│       ├── select.tsx
│       ├── skeleton.tsx
│       └── table.tsx
├── lib/
│   ├── auth-client.ts          # Better Auth client instance
│   └── utils.ts                # cn() utility
├── pages/
│   ├── __tests__/
│   │   └── Users.test.tsx      # Vitest unit tests (12 tests)
│   ├── Dashboard.tsx
│   ├── Login.tsx
│   └── Users.tsx               # User management (Admin only)
├── App.tsx                     # Routes: ProtectedRoute, AdminRoute, GuestRoute
├── main.tsx
└── setupTests.ts               # @testing-library/jest-dom setup
```

## Environment variables

| Variable | Default | Description |
|:---------|:--------|:------------|
| `VITE_API_URL` | `""` | API base URL (empty = same origin via Vite proxy) |
| `VITE_PROXY_TARGET` | `http://localhost:5000` | Backend URL for Vite dev proxy |

## Routing

| Path | Component | Guard |
|:-----|:----------|:------|
| `/login` | `Login` | GuestRoute (redirects to `/` if authenticated) |
| `/` | `Dashboard` | ProtectedRoute (redirects to `/login` if not authenticated) |
| `/users` | `Users` | AdminRoute (redirects to `/` if not admin) |
