import { test, expect, type Page, type APIRequestContext } from "@playwright/test";

const ADMIN_EMAIL    = "admin@wisright.com";
const ADMIN_PASSWORD = "Test@123";
const AGENT_EMAIL    = "agent@wisright.com";
const AGENT_PASSWORD = "Test@123";
const BASE           = (process.env.TEST_BACKEND_URL ?? "http://localhost:5001").replace("localhost", "127.0.0.1");

async function loginAs(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page).toHaveURL("/");
}

async function seedTicket(request: APIRequestContext): Promise<string> {
  const res = await request.post(`${BASE}/api/webhooks/email`, {
    data: {
      from:    "ux-test@example.com",
      subject: "UX improvements test ticket",
      body:    "Testing the full-screen ticket detail and replies changes.",
    },
    headers: { "Content-Type": "application/json" },
  });
  expect(res.status()).toBe(201);
  const { ticketId } = await res.json();
  return ticketId as string;
}

// ── Suite 1: Sidebar nav by role ──────────────────────────────────────────────

test.describe("Sidebar navigation by role", () => {
  test("admin does NOT see My Tickets in sidebar", async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    const sidebar = page.locator("aside");
    await expect(sidebar.getByRole("link", { name: "My Tickets" })).not.toBeVisible();
  });

  test("admin sees Raise Ticket in sidebar", async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    const sidebar = page.locator("aside");
    await expect(sidebar.getByRole("link", { name: "Raise Ticket" })).toBeVisible();
  });

  test("admin Raise Ticket link navigates to /internal/submit", async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await page.locator("aside").getByRole("link", { name: "Raise Ticket" }).click();
    await expect(page).toHaveURL("/internal/submit");
  });

  test("agent sees My Tickets in sidebar", async ({ page }) => {
    await loginAs(page, AGENT_EMAIL, AGENT_PASSWORD);
    const sidebar = page.locator("aside");
    await expect(sidebar.getByRole("link", { name: "My Tickets" })).toBeVisible();
  });

  test("agent does NOT see Raise Ticket in sidebar", async ({ page }) => {
    await loginAs(page, AGENT_EMAIL, AGENT_PASSWORD);
    const sidebar = page.locator("aside");
    await expect(sidebar.getByRole("link", { name: "Raise Ticket" })).not.toBeVisible();
  });
});

// ── Suite 2: Ticket detail page layout ───────────────────────────────────────

test.describe("Ticket detail page layout", () => {
  test("ticket detail page is full-width (no max-w-4xl constraint)", async ({ page, request }) => {
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    const ticketId = await seedTicket(request);
    await page.goto(`/tickets/${ticketId}`);

    // The outer wrapper should NOT have a max-w-4xl class
    const wrapper = page.locator("div.max-w-4xl");
    await expect(wrapper).toHaveCount(0);
  });

  test("ticket detail page has sticky metadata sidebar", async ({ page, request }) => {
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    const ticketId = await seedTicket(request);
    await page.goto(`/tickets/${ticketId}`);
    await page.waitForResponse((r) => r.url().includes(`/api/tickets/${ticketId}`) && r.status() === 200);

    // Sidebar container must carry the sticky class at large breakpoints
    const sidebarContainer = page.locator("[class*='lg\\:sticky']");
    await expect(sidebarContainer).toBeAttached();
    await expect(page.getByText("Details")).toBeVisible();
  });

  test("ticket detail has two-column layout (main content + sidebar)", async ({ page, request }) => {
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    const ticketId = await seedTicket(request);
    await page.goto(`/tickets/${ticketId}`);
    await page.waitForResponse((r) => r.url().includes(`/api/tickets/${ticketId}`) && r.status() === 200);

    // Flex-row container with lg breakpoint confirms two-column intent
    const layoutContainer = page.locator("[class*='lg\\:flex-row']");
    await expect(layoutContainer).toBeAttached();

    // Both main content (back link) and sidebar (Details) must co-exist
    await expect(page.getByRole("link", { name: "Back to Tickets" })).toBeVisible();
    await expect(page.getByText("Details")).toBeVisible();
  });
});

// ── Suite 3: REPLIES section deduplication ───────────────────────────────────

test.describe("REPLIES section — no duplicate description", () => {
  test("REPLIES section does not repeat the ticket description as first entry", async ({
    page,
    request,
  }) => {
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    const ticketId = await seedTicket(request);
    await page.goto(`/tickets/${ticketId}`);
    await page.waitForResponse((r) => r.url().includes(`/api/tickets/${ticketId}`) && r.status() === 200);

    // The description should appear exactly once — in the DESCRIPTION section
    const descriptionSection = page.locator("text=DESCRIPTION").locator("..");
    await expect(descriptionSection).toBeVisible();
    await expect(
      descriptionSection.getByText("Testing the full-screen ticket detail and replies changes.")
    ).toHaveCount(1);

    // The REPLIES section should NOT contain a Customer badge before any reply is posted
    const repliesSection = page
      .getByRole("heading", { name: /Replies/i })
      .locator("xpath=following-sibling::div[1]");
    const customerBadgesInReplies = repliesSection.locator("span", { hasText: "Customer" });
    await expect(customerBadgesInReplies).toHaveCount(0);
  });
});
