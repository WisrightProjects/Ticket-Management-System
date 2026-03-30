# Ticket Management System

A full-stack ticket management system built with React and Express.js for centralizing support requests and task tracking across teams.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 19, TypeScript, Vite, Tailwind CSS 4, shadcn/ui |
| **Backend** | Express.js 5, TypeScript, Bun runtime |
| **Database** | PostgreSQL 17, Prisma 7 ORM |
| **Auth** | Better Auth (email/password, database sessions) |
| **Testing** | Playwright (end-to-end) |

## Features

- **Authentication** -- Email/password login with session management (sign-up disabled, admin creates users)
- **Role-Based Access** -- Admin and Agent roles with route-level protection
- **User Management** -- Admin can create and manage team members
- **Ticket CRUD** -- Create, view, filter, and update tickets (TKT-0001 format)
- **Comments & History** -- Collaboration on tickets with full audit trail
- **Dashboard** -- Overview with status counts and recent activity
- **Security** -- Helmet headers, CORS, rate limiting, input validation

## Project Structure

```
Ticket-Management-System/
├── client/                 # React frontend (Vite)
│   ├── src/
│   │   ├── components/     # Shared UI components (Navbar, shadcn/ui)
│   │   ├── pages/          # Login, Dashboard, Users
│   │   └── lib/            # Auth client, utilities
│   └── vite.config.ts
├── server/                 # Express.js backend
│   ├── src/
│   │   ├── lib/            # Auth config, Prisma client
│   │   └── middleware/     # Auth middleware
│   └── prisma/
│       ├── schema.prisma   # Database schema
│       ├── migrations/     # SQL migrations
│       └── seed.ts         # Default admin user seed
├── tests/                  # Playwright e2e tests
│   ├── auth.spec.ts        # Authentication tests (46 tests)
│   ├── global-setup.ts     # Test DB setup
│   └── global-teardown.ts  # Test DB cleanup
└── playwright.config.ts
```

## Prerequisites

- [Bun](https://bun.sh/) (runtime and package manager)
- [PostgreSQL 17](https://www.postgresql.org/) running on port 5433
- [Node.js](https://nodejs.org/) (for Playwright)

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/Yuvaraj-3007/Ticket-Management-System.git
cd Ticket-Management-System
```

### 2. Install dependencies

```bash
# Root (Playwright)
bun install

# Server
cd server && bun install

# Client
cd ../client && bun install
```

### 3. Configure environment variables

```bash
cp server/.env.example server/.env
```

Edit `server/.env`:

```env
PORT=5000
DATABASE_URL=postgresql://postgres:your_password@localhost:5433/ticket_management
BETTER_AUTH_SECRET=your-secret-key-min-32-chars
BETTER_AUTH_URL=http://localhost:5000
CLIENT_URL=http://localhost:5173
NODE_ENV=development
```

### 4. Set up the database

```bash
cd server
bunx prisma migrate deploy
bun run prisma/seed.ts
```

This creates the tables and seeds a default admin user:
- **Email:** `admin@wisright.com`
- **Password:** `Test@123`

### 5. Start the development servers

```bash
# Terminal 1 -- Backend (port 5000)
cd server && bun run src/index.ts

# Terminal 2 -- Frontend (port 5173)
cd client && bun run dev
```

Open [http://localhost:5173](http://localhost:5173) and log in with the admin credentials.

## Running Tests

The project uses Playwright for end-to-end testing with a separate test database (`ticket_management_test`).

```bash
# Run all tests (headless)
bunx playwright test

# Run with UI mode
bunx playwright test --ui

# Run specific test file
bunx playwright test tests/auth.spec.ts

# View test report
bunx playwright show-report tests/playwright-report
```

The test suite automatically:
- Creates a clean test database before each run
- Starts the backend (port 5001) and frontend (port 5174) servers
- Seeds the admin user
- Cleans up after tests complete

## Database Schema

| Model | Description |
|-------|-------------|
| **User** | Email, name, role (ADMIN/AGENT), active status |
| **Session** | Database-backed auth sessions (7-day expiry) |
| **Ticket** | Title, description, type, priority, status, assignee |
| **Comment** | Threaded comments on tickets |
| **Attachment** | File attachments on tickets |
| **TicketHistory** | Audit trail for all ticket changes |

### Enums

- **TicketType:** BUG, REQUIREMENT, TASK, SUPPORT
- **Priority:** LOW, MEDIUM, HIGH, CRITICAL
- **Status:** OPEN, IN_PROGRESS, RESOLVED, CLOSED

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/sign-in/email` | Login |
| POST | `/api/auth/sign-out` | Logout |
| GET | `/api/auth/get-session` | Get current session |
| GET | `/api/health` | Health check |

## License

This project is for internal use.
