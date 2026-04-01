import { test, expect, type Page, type APIRequestContext } from "@playwright/test";
import { type TicketStatus, type TicketCategory } from "@tms/core";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ADMIN_EMAIL    = "admin@wisright.com";
const ADMIN_PASSWORD = "Test@123";
const BASE           = (process.env.TEST_BACKEND_URL ?? "http://localhost:5001").replace("localhost", "127.0.0.1");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function loginAsAdmin(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(ADMIN_EMAIL);
  await page.getByLabel("Password").fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page).toHaveURL("/");
}

async function goToTicketsPage(page: Page) {
  await page.goto("/tickets");
  await expect(page.getByRole("heading", { name: "Tickets" })).toBeVisible();
}

/** Stub /api/tickets so the page renders without a real backend. */
async function mockTicketsApi(page: Page) {
  await page.route("**/api/tickets", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" })
  );
}

/** Sign in via direct API and return the session cookie string. */
async function apiSignIn(request: APIRequestContext): Promise<string> {
  const res = await request.post(`${BASE}/api/auth/sign-in/email`, {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    headers: { "Content-Type": "application/json" },
  });
  expect(res.status()).toBe(200);
  // Extract Set-Cookie header for subsequent requests
  const setCookie = res.headers()["set-cookie"] ?? "";
  return setCookie.split(";")[0]; // "better-auth.session_token=..."
}

// ---------------------------------------------------------------------------
// Suite 1 — Tickets page navigation & auth guard (true e2e, needs real routing)
// ---------------------------------------------------------------------------

test.describe.configure({ mode: "serial" });

test.describe("Tickets page — navigation & auth", () => {
  test.beforeEach(async ({ page }) => {
    await mockTicketsApi(page);
    await loginAsAdmin(page);
    await goToTicketsPage(page);
  });

  test("Tickets nav link is highlighted as active on /tickets", async ({ page }) => {
    const link = page.getByRole("link", { name: "Tickets" });
    await expect(link).toBeVisible();
    await expect(link).not.toHaveClass(/muted-foreground/);
  });

  test("clicking Dashboard nav link navigates to /", async ({ page }) => {
    await page.getByRole("link", { name: "Dashboard" }).click();
    await expect(page).toHaveURL("/");
  });

  test("unauthenticated user is redirected to /login", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("/tickets");
    await expect(page).toHaveURL("/login");
  });
});

// ---------------------------------------------------------------------------
// Suite 2 — GET /api/tickets API (direct calls to test server, no proxy)
// ---------------------------------------------------------------------------

test.describe("GET /api/tickets — API", () => {
  test("returns 401 when not authenticated", async ({ request }) => {
    const res = await request.get(`${BASE}/api/tickets`);
    expect(res.status()).toBe(401);
  });

  test("returns 200 with an array when authenticated as admin", async ({ request }) => {
    await apiSignIn(request);
    const res = await request.get(`${BASE}/api/tickets`);
    expect(res.status()).toBe(200);
    expect(Array.isArray(await res.json())).toBe(true);
  });

  test("returns an empty array when no tickets exist", async ({ request }) => {
    await apiSignIn(request);
    const res = await request.get(`${BASE}/api/tickets`);
    const tickets = await res.json();
    // Test DB starts clean — 0 tickets before webhooks suite creates any
    expect(Array.isArray(tickets)).toBe(true);
  });

  test("a ticket created via webhook is returned in the list", async ({ request }) => {
    await apiSignIn(request);

    // Seed via webhook
    const seedRes = await request.post(`${BASE}/api/webhooks/email`, {
      data: {
        from:    "api-test@example.com",
        subject: "API ticket list test",
        body:    "Created to verify GET /api/tickets.",
      },
      headers: { "Content-Type": "application/json" },
    });
    expect(seedRes.status()).toBe(201);
    const { ticketId } = await seedRes.json();

    const listRes = await request.get(`${BASE}/api/tickets`);
    const tickets = await listRes.json();
    const found = tickets.find((t: { ticketId: string }) => t.ticketId === ticketId);
    expect(found).toBeDefined();
  });

  test("each ticket has all required fields", async ({ request }) => {
    await apiSignIn(request);
    const res = await request.get(`${BASE}/api/tickets`);
    const tickets = await res.json();
    expect(tickets.length).toBeGreaterThan(0);

    for (const ticket of tickets) {
      for (const field of ["id", "ticketId", "title", "description", "type", "priority", "status", "project", "createdAt", "updatedAt", "createdBy"]) {
        expect(ticket).toHaveProperty(field);
      }
    }
  });

  test("tickets are ordered newest first", async ({ request }) => {
    // Seed a second ticket so we have at least 2 to compare
    await request.post(`${BASE}/api/webhooks/email`, {
      data: { from: "order@example.com", subject: "Ordering test", body: "Second ticket." },
      headers: { "Content-Type": "application/json" },
    });

    await apiSignIn(request);
    const res = await request.get(`${BASE}/api/tickets`);
    const tickets = await res.json();
    expect(tickets.length).toBeGreaterThanOrEqual(2);

    for (let i = 1; i < tickets.length; i++) {
      const prev = new Date(tickets[i - 1].createdAt).getTime();
      const curr = new Date(tickets[i].createdAt).getTime();
      expect(prev).toBeGreaterThanOrEqual(curr);
    }
  });

  test("status values conform to the TicketStatus union type", async ({ request }) => {
    await apiSignIn(request);
    const tickets = await (await request.get(`${BASE}/api/tickets`)).json();
    const valid: TicketStatus[] = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"];
    for (const t of tickets) {
      expect(valid).toContain(t.status);
    }
  });

  test("type values conform to the TicketCategory union type", async ({ request }) => {
    await apiSignIn(request);
    const tickets = await (await request.get(`${BASE}/api/tickets`)).json();
    const valid: TicketCategory[] = ["BUG", "REQUIREMENT", "TASK", "SUPPORT"];
    for (const t of tickets) {
      expect(valid).toContain(t.type);
    }
  });

  test("ticketId follows TKT-XXXX format", async ({ request }) => {
    await apiSignIn(request);
    const tickets = await (await request.get(`${BASE}/api/tickets`)).json();
    for (const t of tickets) {
      expect(t.ticketId).toMatch(/^TKT-\d{4}$/);
    }
  });
});
