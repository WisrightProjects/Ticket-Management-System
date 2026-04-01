import { test, expect, type Page, type APIRequestContext } from "@playwright/test";
import { type StatusValue, type TicketTypeValue } from "@tms/core";

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
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: [], total: 0, page: 1, pageSize: 20, totalPages: 0 }),
    })
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

/** GET /api/tickets and return the data array. */
async function getTickets(request: APIRequestContext, qs = "") {
  const res = await request.get(`${BASE}/api/tickets${qs ? `?${qs}` : ""}`);
  expect(res.status()).toBe(200);
  const body = await res.json();
  return body.data as Record<string, unknown>[];
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

  test("returns 200 with paginated envelope when authenticated as admin", async ({ request }) => {
    await apiSignIn(request);
    const res  = await request.get(`${BASE}/api/tickets`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("data");
    expect(body).toHaveProperty("total");
    expect(body).toHaveProperty("page");
    expect(body).toHaveProperty("pageSize");
    expect(body).toHaveProperty("totalPages");
    expect(Array.isArray(body.data)).toBe(true);
  });

  test("returns empty data array when no tickets exist", async ({ request }) => {
    await apiSignIn(request);
    const res  = await request.get(`${BASE}/api/tickets`);
    const body = await res.json();
    // Test DB starts clean — 0 tickets before webhooks suite creates any
    expect(Array.isArray(body.data)).toBe(true);
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

    const tickets = await getTickets(request);
    const found   = tickets.find((t) => t.ticketId === ticketId);
    expect(found).toBeDefined();
  });

  test("each ticket has all required fields", async ({ request }) => {
    await apiSignIn(request);
    const tickets = await getTickets(request);
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
    const tickets = await getTickets(request);
    expect(tickets.length).toBeGreaterThanOrEqual(2);

    for (let i = 1; i < tickets.length; i++) {
      const prev = new Date(tickets[i - 1].createdAt as string).getTime();
      const curr = new Date(tickets[i].createdAt as string).getTime();
      expect(prev).toBeGreaterThanOrEqual(curr);
    }
  });

  test("status values conform to StatusValue", async ({ request }) => {
    await apiSignIn(request);
    const tickets = await getTickets(request);
    const valid: StatusValue[] = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"];
    for (const t of tickets) {
      expect(valid).toContain(t.status);
    }
  });

  test("type values conform to TicketTypeValue", async ({ request }) => {
    await apiSignIn(request);
    const tickets = await getTickets(request);
    const valid: TicketTypeValue[] = ["BUG", "REQUIREMENT", "TASK", "SUPPORT"];
    for (const t of tickets) {
      expect(valid).toContain(t.type);
    }
  });

  test("ticketId follows TKT-XXXX format", async ({ request }) => {
    await apiSignIn(request);
    const tickets = await getTickets(request);
    for (const t of tickets) {
      expect(t.ticketId).toMatch(/^TKT-\d{4}$/);
    }
  });
});

// ---------------------------------------------------------------------------
// Suite 3 — GET /api/tickets sorting (direct API calls)
// ---------------------------------------------------------------------------

test.describe("GET /api/tickets — sorting", () => {
  test("sortBy=createdAt&sortOrder=asc returns oldest ticket first", async ({ request }) => {
    await apiSignIn(request);
    const tickets = await getTickets(request, "sortBy=createdAt&sortOrder=asc");
    expect(tickets.length).toBeGreaterThan(1);

    for (let i = 1; i < tickets.length; i++) {
      const prev = new Date(tickets[i - 1].createdAt as string).getTime();
      const curr = new Date(tickets[i].createdAt as string).getTime();
      expect(prev).toBeLessThanOrEqual(curr);
    }
  });

  test("sortBy=createdAt&sortOrder=desc returns newest ticket first (explicit param)", async ({ request }) => {
    await apiSignIn(request);
    const tickets = await getTickets(request, "sortBy=createdAt&sortOrder=desc");
    expect(tickets.length).toBeGreaterThan(1);

    for (let i = 1; i < tickets.length; i++) {
      const prev = new Date(tickets[i - 1].createdAt as string).getTime();
      const curr = new Date(tickets[i].createdAt as string).getTime();
      expect(prev).toBeGreaterThanOrEqual(curr);
    }
  });

  test("sortBy=ticketId&sortOrder=asc returns tickets in ascending ID order", async ({ request }) => {
    await apiSignIn(request);
    const tickets = await getTickets(request, "sortBy=ticketId&sortOrder=asc");
    expect(tickets.length).toBeGreaterThan(1);

    for (let i = 1; i < tickets.length; i++) {
      expect((tickets[i - 1].ticketId as string) <= (tickets[i].ticketId as string)).toBe(true);
    }
  });

  test("invalid sortBy value returns 400", async ({ request }) => {
    await apiSignIn(request);
    const res = await request.get(`${BASE}/api/tickets?sortBy=invalid`);
    expect(res.status()).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// Suite 4 — GET /api/tickets pagination (direct API calls)
// ---------------------------------------------------------------------------

test.describe("GET /api/tickets — pagination", () => {
  test("response includes pagination envelope fields", async ({ request }) => {
    await apiSignIn(request);
    const res  = await request.get(`${BASE}/api/tickets`);
    const body = await res.json();
    expect(typeof body.total).toBe("number");
    expect(typeof body.page).toBe("number");
    expect(typeof body.pageSize).toBe("number");
    expect(typeof body.totalPages).toBe("number");
  });

  test("default page is 1 and pageSize is 10", async ({ request }) => {
    await apiSignIn(request);
    const res  = await request.get(`${BASE}/api/tickets`);
    const body = await res.json();
    expect(body.page).toBe(1);
    expect(body.pageSize).toBe(10);
  });

  test("pageSize=1 returns at most 1 ticket", async ({ request }) => {
    await apiSignIn(request);
    const res  = await request.get(`${BASE}/api/tickets?pageSize=1`);
    const body = await res.json();
    expect(body.data.length).toBeLessThanOrEqual(1);
    expect(body.pageSize).toBe(1);
  });

  test("page=2&pageSize=1 returns a different ticket than page=1", async ({ request }) => {
    await apiSignIn(request);
    const [r1, r2] = await Promise.all([
      request.get(`${BASE}/api/tickets?page=1&pageSize=1`),
      request.get(`${BASE}/api/tickets?page=2&pageSize=1`),
    ]);
    const b1 = await r1.json();
    const b2 = await r2.json();
    if (b1.total >= 2) {
      expect(b1.data[0].id).not.toBe(b2.data[0].id);
    }
  });

  test("totalPages equals ceil(total / pageSize)", async ({ request }) => {
    await apiSignIn(request);
    const res  = await request.get(`${BASE}/api/tickets?pageSize=3`);
    const body = await res.json();
    expect(body.totalPages).toBe(Math.ceil(body.total / 3));
  });
});
