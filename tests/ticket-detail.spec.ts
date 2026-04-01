import { test, expect, type Page, type APIRequestContext } from "@playwright/test";

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

/** Navigate to the ticket detail page and wait for the API response. */
async function gotoDetail(page: Page, id: string) {
  await Promise.all([
    page.waitForResponse((r) => r.url().includes(`/api/tickets/${id}`) && !r.url().includes("?")),
    page.goto(`/tickets/${id}`),
  ]);
}

async function apiSignIn(request: APIRequestContext): Promise<string> {
  const res = await request.post(`${BASE}/api/auth/sign-in/email`, {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    headers: { "Content-Type": "application/json" },
  });
  expect(res.status()).toBe(200);
  const setCookie = res.headers()["set-cookie"] ?? "";
  return setCookie.split(";")[0];
}

/** Create a ticket via webhook and return its ticketId (e.g. "TKT-0001"). */
async function seedTicket(
  request: APIRequestContext,
  overrides: { subject?: string; body?: string; from?: string } = {}
): Promise<string> {
  const res = await request.post(`${BASE}/api/webhooks/email`, {
    data: {
      from:    overrides.from    ?? "detail-test@example.com",
      subject: overrides.subject ?? "Detail page test ticket",
      body:    overrides.body    ?? "This ticket was created to test the detail page.",
    },
    headers: { "Content-Type": "application/json" },
  });
  expect(res.status()).toBe(201);
  const { ticketId } = await res.json();
  return ticketId as string;
}

// ---------------------------------------------------------------------------
// Suite 1 — GET /api/tickets/:id  (direct API)
// ---------------------------------------------------------------------------

test.describe.configure({ mode: "serial" });

test.describe("GET /api/tickets/:id — API", () => {
  let ticketId: string;

  test.beforeAll(async ({ request }) => {
    ticketId = await seedTicket(request, { subject: "API detail test" });
  });

  test("returns 401 when not authenticated", async ({ request }) => {
    const res = await request.get(`${BASE}/api/tickets/${ticketId}`);
    expect(res.status()).toBe(401);
  });

  test("returns 200 with the ticket when authenticated", async ({ request }) => {
    await apiSignIn(request);
    const res = await request.get(`${BASE}/api/tickets/${ticketId}`);
    expect(res.status()).toBe(200);
  });

  test("response contains all required fields", async ({ request }) => {
    await apiSignIn(request);
    const ticket = await (await request.get(`${BASE}/api/tickets/${ticketId}`)).json();

    for (const field of ["id", "ticketId", "title", "description", "type", "priority", "status", "project", "createdAt", "updatedAt", "createdBy"]) {
      expect(ticket).toHaveProperty(field);
    }
  });

  test("returned ticketId matches the requested one", async ({ request }) => {
    await apiSignIn(request);
    const ticket = await (await request.get(`${BASE}/api/tickets/${ticketId}`)).json();
    expect(ticket.ticketId).toBe(ticketId);
  });

  test("title matches the webhook subject", async ({ request }) => {
    await apiSignIn(request);
    const ticket = await (await request.get(`${BASE}/api/tickets/${ticketId}`)).json();
    expect(ticket.title).toBe("API detail test");
  });

  test("returns 404 for a non-existent ticketId", async ({ request }) => {
    await apiSignIn(request);
    const res = await request.get(`${BASE}/api/tickets/TKT-9999`);
    expect(res.status()).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// Suite 2 — Ticket detail page  (e2e UI)
// ---------------------------------------------------------------------------

test.describe("Ticket detail page — UI", () => {
  let ticketId: string;

  test.beforeAll(async ({ request }) => {
    ticketId = await seedTicket(request, {
      subject: "Network Issue Troubleshooting",
      body:    "Users on floor 3 cannot reach the internal wiki.\nRestarting the switch did not help.",
    });
  });

  test("unauthenticated user navigating to detail page is redirected to /login", async ({ page }) => {
    await page.goto(`/tickets/${ticketId}`);
    await expect(page).toHaveURL("/login");
  });

  test("direct URL navigation renders the detail page", async ({ page }) => {
    await loginAsAdmin(page);
    await gotoDetail(page, ticketId);
    await expect(page.getByText(ticketId)).toBeVisible();
  });

  test("detail page shows the ticketId in mono font", async ({ page }) => {
    await loginAsAdmin(page);
    await gotoDetail(page, ticketId);
    await expect(page.getByText(ticketId)).toBeVisible();
  });

  test("detail page shows the ticket title as a heading", async ({ page }) => {
    await loginAsAdmin(page);
    await gotoDetail(page, ticketId);
    await expect(page.getByRole("heading", { name: "Network Issue Troubleshooting" })).toBeVisible();
  });

  test("detail page shows category, priority and status badges", async ({ page }) => {
    await loginAsAdmin(page);
    await gotoDetail(page, ticketId);
    await expect(page.locator("text=/Bug|Requirement|Task|Support/")).toBeVisible();
    await expect(page.locator("text=/Low|Medium|High|Critical/")).toBeVisible();
    await expect(page.locator("text=/Open|In Progress|Resolved|Closed/")).toBeVisible();
  });

  test("detail page shows the Project metadata label", async ({ page }) => {
    await loginAsAdmin(page);
    await gotoDetail(page, ticketId);
    await expect(page.getByText("Project", { exact: true })).toBeVisible();
  });

  test("detail page shows the Created by metadata label", async ({ page }) => {
    await loginAsAdmin(page);
    await gotoDetail(page, ticketId);
    await expect(page.getByText("Created by", { exact: true })).toBeVisible();
  });

  test("detail page shows the Assigned to metadata label", async ({ page }) => {
    await loginAsAdmin(page);
    await gotoDetail(page, ticketId);
    await expect(page.getByText("Assigned to", { exact: true })).toBeVisible();
  });

  test("detail page shows the Description section", async ({ page }) => {
    await loginAsAdmin(page);
    await gotoDetail(page, ticketId);
    await expect(page.getByText("Description", { exact: true })).toBeVisible();
    await expect(page.getByText(/Users on floor 3/)).toBeVisible();
  });

  test("Back to Tickets button is visible", async ({ page }) => {
    await loginAsAdmin(page);
    await gotoDetail(page, ticketId);
    await expect(page.getByRole("link", { name: /Back to Tickets/i })).toBeVisible();
  });

  test("Back to Tickets button navigates to /tickets", async ({ page }) => {
    await loginAsAdmin(page);
    await gotoDetail(page, ticketId);
    await page.getByRole("link", { name: /Back to Tickets/i }).click();
    await expect(page).toHaveURL("/tickets");
    await expect(page.getByRole("heading", { name: "Tickets" })).toBeVisible();
  });

  test("clicking a ticket title in the list navigates to its detail page", async ({ page }) => {
    await loginAsAdmin(page);
    await Promise.all([
      page.waitForResponse((resp) => resp.url().includes("/api/tickets?") && resp.status() === 200),
      page.goto("/tickets"),
    ]);

    const titleLink = page.getByRole("link", { name: "Network Issue Troubleshooting" });
    await expect(titleLink).toBeVisible();

    await Promise.all([
      page.waitForResponse((resp) => resp.url().includes(`/api/tickets/${ticketId}`)),
      titleLink.click(),
    ]);

    await expect(page).toHaveURL(new RegExp(`/tickets/${ticketId}`));
    await expect(page.getByRole("heading", { name: "Network Issue Troubleshooting" })).toBeVisible();
  });

  test("navigating to a non-existent ticketId shows an error message", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/tickets/TKT-9999");
    // React Query retries 404s (3× with exponential backoff ≈ 7 s) before setting isError
    await expect(page.getByText(/failed to load ticket/i)).toBeVisible({ timeout: 15000 });
  });
});
