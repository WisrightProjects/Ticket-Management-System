# Coding Guidelines

## Role strings

Never use `"ADMIN"` or `"AGENT"` as string literals anywhere in the client or server code.

Always import and use the shared constants from `@tms/core`:

```ts
import { ROLES } from "@tms/core";

// ✅ correct
if (user.role === ROLES.ADMIN) { ... }
defaultValues: { role: ROLES.AGENT }

// ❌ wrong
if (user.role === "ADMIN") { ... }
defaultValues: { role: "AGENT" }
```

Use `UserRole` as the TypeScript type for any role value:

```ts
import { type UserRole } from "@tms/core";

function doSomething(role: UserRole) { ... }
```

Use `USER_ROLES` (the tuple `["ADMIN", "AGENT"]`) only when you need to enumerate all roles, e.g. for a `z.enum(USER_ROLES)` schema or a `.includes()` check.

This rule applies to:
- React components (`App.tsx`, `Navbar.tsx`, `Users.tsx`, etc.)
- Tests (fixture objects inside test bodies — `vi.mock` factory strings are exempt since they are hoisted before imports)
- Any future server route or middleware that references role values
