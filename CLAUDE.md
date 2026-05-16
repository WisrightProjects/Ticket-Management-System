# Right Tracker (TMS) — Claude Code Instructions

> **MANDATORY:** Claude MUST follow every rule in this file without exception.
> These instructions override Claude's default behaviors entirely.

---

## RULE 1 — PLAN BEFORE IMPLEMENTING (REQUIRED, NO EXCEPTIONS)

For **every implementation request** (new feature, bug fix, refactor, or any code change), follow this exact sequence:

1. **Enter Plan Mode first** using the `EnterPlanMode` tool.
2. Present a clear plan covering:
   - What files will be created or modified
   - What the API / data shape looks like (schemas, routes, props)
   - What edge cases or constraints matter
   - Any risks or alternatives considered
3. **Wait for the user to proceed** (implicit or explicit acceptance) before writing any code.
4. Only after acceptance: exit Plan Mode and implement.

**This rule has zero exceptions.** A one-line change still requires a plan.

---

## RULE 2 — NEVER COMMIT OR PUSH WITHOUT EXPLICIT INSTRUCTION

> Pre-commit and pre-push hooks (Lefthook) run automatically. Do not use `--no-verify` unless explicitly asked.

- **Never run `git commit` or `git push` unless the user explicitly says so.**
- Phrases like "save this", "apply this", "looks good" do NOT count as permission.
- Accepted triggers: "commit and push it", "go ahead and commit", "push it".
- When committing: stage specific files by name, never `git add -A`, write a meaningful message, append `Co-Authored-By` footer.

**This rule has no exceptions — not even for "minor" changes like docs or config files.**

---

## RULE 3 — CODE QUALITY & SECURITY STANDARDS

Every change must meet these standards:

### Quality
- No unused variables, imports, or dead code introduced.
- No logic duplication — reuse existing utilities/hooks/components where they exist.
- TypeScript types must be correct; avoid `any` unless absolutely necessary.
- Async operations must handle errors properly.
- No `console.log` left in production code paths.

### Security
- No hardcoded secrets, tokens, passwords, or API keys in source files.
- All environment variables go in `.env` (gitignored).
- User input at system boundaries must be validated/sanitized.
- No SQL injection, XSS, command injection, or OWASP Top 10 vulnerabilities.
- File uploads: always validate MIME type, extension, magic bytes, and size.
- API key endpoints: always check `x-api-key` before running any logic.

### After Writing Code
- Automatically trigger the `security-quality-reviewer` agent for any non-trivial change.
- Fix all flagged issues before presenting the result to the user.

---

## RULE 4 — AGENT SELECTION & MULTI-AGENT USAGE

Use the right agent for the right task. **Do not default to doing everything inline.**

### Available Agents

| Agent | When to Use |
|-------|-------------|
| **Explore** | Finding files by pattern, searching for keywords, understanding how a feature works, "where is X?" questions |
| **Plan** | Designing implementation strategy inside Plan Mode — identifying critical files, trade-offs |
| **general-purpose** | Open-ended research, multi-step investigations, tasks requiring many rounds of search + read + analysis |
| **security-quality-reviewer** | After writing or modifying any non-trivial code — reviews for security vulnerabilities and quality |
| **coderabbit-pr-guard** | Before raising a PR — reviews ALL files changed in the branch vs target, not just the latest commit |
| **claude-code-guide** | Questions about Claude Code CLI features, hooks, MCP servers, or the Anthropic API |

### Decision Rules

**1. Codebase exploration → always use Explore agent**
- Never manually grep + read in a loop when the task is "find where X is"
- For broad exploration: launch up to 3 Explore agents in parallel
- For narrow, known-file searches: use Glob/Grep directly

**2. After every non-trivial code change → always trigger security-quality-reviewer**
- Run automatically after implementing features, bug fixes, or refactors
- Do NOT present code to the user until all flagged issues are fixed
- Trivial changes (typo, comment, config value) are exempt

**3. Before raising a PR → always trigger coderabbit-pr-guard**
- Run `git diff <target-branch>...HEAD --name-only` to get the full file list
- Review ALL files in that list — PRs accumulate multiple commits
- Specific patterns to check every review:
  - Zero-update operations — must not silently return empty
  - Input trimming — strings validated for non-empty must be `.trim()`-ed first
  - `|| undefined` in API payloads — use `|| null` instead (undefined is dropped by JSON.stringify)
  - Prisma `createMany`/`updateMany` without `skipDuplicates` where needed
  - Missing `await` on async calls in route handlers

**4. Parallel vs Sequential**

Run in parallel when tasks are independent (e.g., backend + frontend + tests).
Run sequentially when one agent's output feeds the next (e.g., explore → plan → implement).

### Parallel agents — match count to complexity

| Situation | Agents |
|:----------|:-------|
| Single file change or simple lookup | No agent — do it directly |
| 2–3 independent files | 2 agents in parallel |
| Large feature (backend + frontend + tests) | 3+ agents in parallel |
| Research across multiple areas | Explore agent |

**Rules:**
- Never spawn an agent for work you can do in one tool call
- Always use a single message with multiple Agent tool calls to run them truly in parallel

---

## RULE 5 — STORY BEFORE IMPLEMENTATION (REQUIRED)

For every new feature or significant change — before entering Plan Mode:

1. **Write or update the story file** in `stories/` at the repo root.
2. The story must include:
   - Overview (what it does and why)
   - User stories ("As a / I want / So that")
   - Acceptance criteria
   - Technical specs (endpoints, files, DB changes)
3. **Present the story and get confirmation** before planning or implementing.

**Why:** Implementation-first leads to features that don't match business rules. Stories catch misunderstandings before code is written.

---

## RULE 6 — TESTS (MANDATORY)

After every implementation, write or update Playwright e2e tests in `tests/`.

- New API endpoint → auth, happy path, validation, 404/400 cases
- New UI page or interaction → navigation, rendering, user flows, error states
- Modified behaviour → update existing tests to match
- Run `npx playwright test` and confirm all pass before marking done
- E2E tests cover only what cannot be unit tested: real API calls, DB persistence, browser navigation, multi-step flows

### What "done" means
1. Plan was presented ✓
2. Code is implemented ✓
3. Playwright tests written/updated ✓
4. All tests pass ✓

---

## Project Quick Reference

| Item | Value |
|------|-------|
| Server | Bun + Express + Prisma + PostgreSQL (port 4000) |
| Client | React + Vite + Shadcn/ui + TanStack Query (port 5173) |
| Production URL | `https://support.wisright.com` |
| WiseWork API | `https://wisework-api.wisright.com/api/v1` |
| WiseWork API key | `TICKET_TRACKER_API_KEY` in WiseWork `.env` |
| TMS API key (for WiseWork) | `WISEWORK_NOTIFICATION_API_KEY` in TMS `.env` |
| Main branch | `main` |
| Dev branch | `main-dev` |
| Auth | better-auth (session cookies) |
| File uploads | Multer → `/uploads/` (disk storage, UUID filenames) |

---

## Reusable UI Components

### `EnumSelect` — `client/src/components/EnumSelect.tsx`

Use for any Select dropdown over a fixed set of string values.

```tsx
import { EnumSelect } from "@/components/EnumSelect";

<EnumSelect
  value={ticket.status}
  options={STATUSES}
  labels={STATUS_LABELS}
  onValueChange={(val) => statusMutation.mutate(val)}
  disabled={statusMutation.isPending}
  isError={statusMutation.isError}
  errorMessage="Failed to update status"
  width="w-[150px]"
/>
```

Do **not** inline a raw `<Select>` + items loop for enum fields — use `EnumSelect`.

---

### `TicketReplies` — `client/src/components/TicketReplies.tsx`

Self-contained reply thread + form for a ticket detail page.

```tsx
import { TicketReplies } from "@/components/TicketReplies";
<TicketReplies ticketId={ticket.ticketId} />
```

Pass the human-readable `ticketId` (e.g. `"TKT-0001"`), not the DB `id`.

---

## Role Strings

Never use `"ADMIN"` or `"AGENT"` as string literals. Always import from `@tms/core`:

```ts
import { ROLES, type UserRole } from "@tms/core";

// ✅ correct
if (user.role === ROLES.ADMIN) { ... }

// ❌ wrong
if (user.role === "ADMIN") { ... }
```

Use `USER_ROLES` (the tuple `["ADMIN", "AGENT"]`) only for `z.enum(USER_ROLES)` or `.includes()` checks.

This rule applies to React components, server routes, middleware, and tests (vi.mock factory strings are exempt).

---

## WiseWork Integration

Right Tracker syncs ticket data to WiseWork (HRMS-POC) via server-to-server calls.

### Key endpoints
- `POST /api/tickets/:id/comments/wisework` — WiseWork posts a developer reply (multipart, API-key auth)
- `PATCH /api/ticket-notifications/priority` — WiseWork notifies TMS of priority change

### Helper: `pushSyncToWisework`
Call this (fire-and-forget: `void pushSyncToWisework(...)`) after:
- Ticket assignment
- Status change
- Any comment creation (agent or customer)

### Customer portal privacy
- AGENT replies show author name to admins and other agents.
- CUSTOMER-facing views show `"Support Team"` — never expose the developer's real name.
