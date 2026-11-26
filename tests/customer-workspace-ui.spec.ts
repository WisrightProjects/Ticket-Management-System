import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const customer = { id: "customer-preview", name: "Priya Sharma", email: "priya@example.test", role: "CUSTOMER", isActive: true };
const now = new Date().toISOString();
const rows = [
  { ticketId: "TKT-0042", title: "Payroll export fails for the October report", status: "OPEN_IN_PROGRESS", priority: "HIGH", type: "BUG", updatedAt: now, organization: { name: "Acme Technologies" } },
  { ticketId: "TKT-0041", title: "Review the employee onboarding implementation plan", status: "CUSTOMER_APPROVAL", priority: "MEDIUM", type: "IMPLEMENTATION", updatedAt: now, organization: { name: "Acme Technologies" } },
];

test.beforeEach(async ({ context }) => {
  await context.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.startsWith("/api/")) {
      let body: unknown = {};
      if (url.pathname.includes("get-session")) body = { user: customer, session: { id: "session-preview", token: "fixture-only", userId: customer.id, expiresAt: new Date(Date.now() + 86400000).toISOString(), createdAt: now, updatedAt: now } };
      else if (url.pathname === "/api/portal/me") body = { ...customer, memberships: [{ role: "MEMBER", organization: { id: "acme", name: "Acme Technologies", slug: "acme" } }] };
      else if (url.pathname === "/api/portal/dashboard") body = { total: 12, active: 5, waiting: 2, resolved: 7, recent: rows };
      else if (url.pathname === "/api/portal/tickets") body = { data: rows, total: 2, totalPages: 1, page: 1, pageSize: 10 };
      else if (url.pathname === "/api/onboarding/invitation") body = { email: customer.email, organization: "Acme Technologies" };
      else if (url.pathname === "/api/onboarding/activate") body = { success: true };
      return route.fulfill({ json: body });
    }
    const dist = path.resolve("client/dist");
    let target = path.resolve(dist, `.${url.pathname}`);
    if (!target.startsWith(`${dist}${path.sep}`) || !fs.existsSync(target) || fs.statSync(target).isDirectory()) target = path.join(dist, "index.html");
    const contentType: Record<string, string> = { ".js": "application/javascript", ".css": "text/css", ".woff2": "font/woff2", ".html": "text/html" };
    return route.fulfill({ body: fs.readFileSync(target), contentType: contentType[path.extname(target)] ?? "application/octet-stream" });
  });
});

test("customer overview and request list navigate correctly", async ({ page }, testInfo) => {
  await page.goto("https://right-tracker.local.test/portal/dashboard");
  await expect(page.getByRole("heading", { name: "Hello, Priya" })).toBeVisible();
  await expect(page.getByText("Awaiting your approval", { exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("customer-overview.png"), fullPage: true });
  await page.getByRole("link", { name: "My requests", exact: true }).click();
  await expect(page.getByRole("heading", { name: "My requests", exact: true })).toBeVisible();
  await page.getByLabel("Search requests").fill("payroll");
  await expect(page).toHaveURL(/search=payroll/);
});

test("request form validates details and reaches review", async ({ page }) => {
  await page.goto("https://right-tracker.local.test/portal/new");
  await expect(page.getByRole("heading", { name: "How can we help?" })).toBeVisible();
  await page.getByLabel("Subject", { exact: true }).fill("Help with payroll export");
  await page.getByLabel("Description", { exact: true }).fill("October payroll export is returning an error.");
  await page.getByRole("button", { name: "Review request" }).click();
  await expect(page.getByRole("heading", { name: "Review your request" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Submit request" })).toBeVisible();
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await expect(page.getByLabel("Subject", { exact: true })).toHaveValue("Help with payroll export");
});

test("customer request sends the selected organization and project", async ({ page }) => {
  await page.route("**/api/portal/organizations/acme/projects", (route) =>
    route.fulfill({ json: [{ id: "payroll", projectName: "Payroll" }] }));
  await page.route("**/api/portal/requests", (route) => {
    const form = route.request().postData() ?? "";
    expect(form).toContain('name="organizationId"\r\n\r\nacme');
    expect(form).toContain('name="projectId"\r\n\r\npayroll');
    return route.fulfill({ status: 201, json: { ticketId: "TKT-0050" } });
  });
  await page.goto("https://right-tracker.local.test/portal/new");
  await page.getByLabel("Project", { exact: true }).selectOption("payroll");
  await page.getByLabel("Subject", { exact: true }).fill("Payroll export issue");
  await page.getByLabel("Description", { exact: true }).fill("The payroll export does not include all employees.");
  await page.getByRole("button", { name: "Review request" }).click();
  await page.getByRole("button", { name: "Submit request" }).click();
  await expect(page).toHaveURL(/\/portal\/tickets\/TKT-0050$/);
});

test("customer navigation works on mobile without page overflow", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("https://right-tracker.local.test/portal/dashboard");
  await expect(page.getByRole("heading", { name: "Hello, Priya" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  await page.screenshot({ path: testInfo.outputPath("customer-mobile.png"), fullPage: true });
  await page.getByRole("button", { name: "Toggle navigation" }).click();
  await page.getByRole("link", { name: "Profile & security" }).click();
  await expect(page.getByRole("heading", { name: "Profile & security" })).toBeVisible();
});

test("invited customer sets their own name and password", async ({ page }) => {
  await page.goto(`https://right-tracker.local.test/activate?token=${"a".repeat(64)}`);
  await expect(page.getByRole("heading", { name: "Set up your account" })).toBeVisible();
  await expect(page.getByLabel("Email address")).toHaveValue(customer.email);
  await page.getByLabel("Your name").fill("Priya Sharma");
  await page.getByLabel("Password", { exact: true }).fill("FixtureOnlyPassword123!");
  await page.getByLabel("Confirm password").fill("FixtureOnlyPassword123!");
  await page.getByRole("button", { name: "Show password", exact: true }).click();
  await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute("type", "text");
  await expect(page.getByLabel("Confirm password")).toHaveAttribute("type", "password");
  await page.getByRole("button", { name: "Show confirmation password" }).click();
  await expect(page.getByLabel("Confirm password")).toHaveAttribute("type", "text");
  await page.getByRole("button", { name: "Hide password", exact: true }).click();
  await page.getByRole("button", { name: "Hide confirmation password" }).click();
  await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute("type", "password");
  await expect(page.getByLabel("Confirm password")).toHaveAttribute("type", "password");
  await page.getByRole("button", { name: "Create my account" }).click();
  await expect(page.getByText("Your account is ready.", { exact: false })).toBeVisible();
  await expect(page.getByRole("link", { name: "Continue to sign in" })).toHaveAttribute("href", "/portal/login");
});

test("client sign-in remembers only the email and clears it when unchecked", async ({ page }) => {
  let authenticated = false;
  await page.route("**/api/auth/get-session", (route) => route.fulfill({
    json: authenticated ? {
      user: customer,
      session: { id: "session-preview", token: "fixture-only", userId: customer.id, expiresAt: "2099-01-01T00:00:00Z" },
    } : null,
  }));
  await page.route("**/api/auth/sign-in/email", (route) => {
    authenticated = true;
    return route.fulfill({ json: { user: customer, token: "fixture-only" } });
  });
  const login = "https://right-tracker.local.test/portal/login";
  await page.goto(login);
  await page.getByLabel("Email address").fill(customer.email);
  await page.getByLabel("Password", { exact: true }).fill("fixture-password");
  await page.getByRole("checkbox", { name: "Remember my email" }).check();
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page).toHaveURL(/\/portal\/dashboard$/);

  authenticated = false;
  await page.goto(login);
  await expect(page.getByLabel("Email address")).toHaveValue(customer.email);
  await expect(page.getByLabel("Password", { exact: true })).toHaveValue("");
  await page.getByRole("checkbox", { name: "Remember my email" }).uncheck();
  await page.reload();
  await expect(page.getByLabel("Email address")).toHaveValue("");
});

test("client password reset reports request failures and confirms a retry", async ({ page }) => {
  let fail = true;
  await page.route("**/api/auth/request-password-reset", (route) => {
    expect(route.request().postDataJSON()).toMatchObject({
      email: customer.email, redirectTo: "https://right-tracker.local.test/portal/reset-password?client=1",
    });
    return fail
      ? route.fulfill({ status: 503, json: { message: "Unavailable" } })
      : route.fulfill({ json: { status: true } });
  });
  await page.goto("https://right-tracker.local.test/portal/forgot-password?client=1");
  await page.getByLabel("Email address").fill(customer.email);
  await page.getByRole("button", { name: "Send Reset Link" }).click();
  await expect(page.getByRole("alert")).toContainText("request a reset link");
  fail = false;
  await page.getByRole("button", { name: "Send Reset Link" }).click();
  await expect(page.getByRole("heading", { name: "Check your inbox" })).toBeVisible();
});
