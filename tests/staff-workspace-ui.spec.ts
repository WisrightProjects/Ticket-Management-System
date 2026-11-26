import { test, expect, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const ADMIN = "00000000-0000-4000-8000-000000000001";
const AGENT = "00000000-0000-4000-8000-000000000002";
const TEAM = "00000000-0000-4000-8000-000000000003";
const NOW = "2026-10-28T10:00:00.000Z";

async function mockStaffApp(page: Page, role: "ADMIN" | "AGENT" = "ADMIN") {
  const user = { id: role === "ADMIN" ? ADMIN : AGENT, name: role === "ADMIN" ? "Support Admin" : "Alice Agent", email: "staff@example.test", role, isActive: true };
  let assignee: { id: string; name: string } | null = role === "ADMIN" ? { id: ADMIN, name: user.name } : null;
  const views: { id: string; name: string; filters: object }[] = [];
  const posted: { url: string; body: string }[] = [];
  const comments: object[] = [];
  let bulkFailure = false;
  let polishResolve: (() => void) | undefined;
  let holdPolish = false;
  await page.addInitScript(() => sessionStorage.setItem("tms_active", "1"));
  await page.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const endpoint = url.pathname;
    if (endpoint.startsWith("/api/")) {
      if (request.method() !== "GET") posted.push({ url: endpoint, body: request.postData() ?? "" });
      let body: unknown = {};
      if (endpoint.includes("get-session")) body = { user, session: { id: "staff-session", token: "fixture-only", userId: user.id, expiresAt: "2099-01-01T00:00:00Z", createdAt: NOW, updatedAt: NOW } };
      else if (endpoint === "/api/work/options") body = {
        staff: [{ id: ADMIN, name: "Support Admin" }, { id: AGENT, name: "Alice Agent" }],
        organizations: [{ id: "org-1", name: "Acme Technologies" }],
        teams: [{ id: TEAM, name: "Product support", members: [{ userId: AGENT, user: { name: "Alice Agent", isActive: true } }] }], myTeamIds: [TEAM],
      };
      else if (endpoint === "/api/work/queue") body = {
        data: [42, 43].map((id) => ({ ticketId: `TKT-00${id}`, title: id === 42 ? "Payroll export fails for October" : "Update onboarding permissions", status: "OPEN_IN_PROGRESS", priority: id === 42 ? "HIGH" : "MEDIUM", type: "SUPPORT", senderName: "Priya Sharma", senderEmail: "priya@example.test", assignedToId: assignee?.id ?? null, assignedTo: assignee, teamId: null, team: null, organization: { id: "org-1", name: "Acme Technologies" }, createdBy: { name: "Support Admin" }, dueAt: "2026-10-27T10:00:00Z", createdAt: NOW, updatedAt: NOW })),
        page: Number(url.searchParams.get("page") ?? 1), total: 22, totalPages: 2, asOf: NOW,
        counts: { all: 22, mine: 5, unassigned: 3, teams: 7, waiting: 2, overdue: 2, recent: 22 },
      };
      else if (endpoint === "/api/work/views") {
        if (request.method() === "POST") { const data = request.postDataJSON(); views.push({ id: "view-1", name: data.name, filters: data.filters }); return route.fulfill({ status: 201, json: views[views.length - 1] }); }
        body = views;
      }
      else if (endpoint.startsWith("/api/work/views/") && request.method() === "DELETE") { views.splice(0); return route.fulfill({ status: 204 }); }
      else if (endpoint === "/api/work/bulk") {
        if (bulkFailure) return route.fulfill({ status: 409, json: { error: "TKT-0043: this status transition is not allowed." } });
        const data = request.postDataJSON();
        if (data.change.field === "assignedToId") assignee = data.change.value ? { id: data.change.value, name: user.name } : null;
        body = { updated: data.ticketIds.length, unchanged: 0 };
      }
      else if (endpoint.endsWith("/assignable-users")) body = [{ id: ADMIN, name: "Support Admin" }, { id: AGENT, name: "Alice Agent" }];
      else if (endpoint === "/api/tickets/clients") body = [];
      else if (endpoint.endsWith("/history")) body = [{ id: "history-1", field: "priority", oldValue: "MEDIUM", newValue: "HIGH", createdAt: NOW, changedBy: { name: "Support Admin" } }];
      else if (endpoint.endsWith("/comments")) {
        if (request.method() === "POST") {
          const raw = request.postData() ?? "";
          const content = raw.match(/name="content"\r\n\r\n([\s\S]*?)\r\n--/)?.[1] ?? "";
          const internal = /name="isInternal"\r\n\r\ntrue/.test(raw);
          const comment = { id: "comment-1", content, isInternal: internal, senderType: "AGENT", author: { id: user.id, name: user.name }, createdAt: NOW, attachments: [] };
          comments.push(comment); return route.fulfill({ status: 201, json: comment });
        }
        body = comments;
      }
      else if (endpoint.endsWith("/polish")) {
        if (holdPolish) await new Promise<void>((resolve) => { polishResolve = resolve; });
        body = { polished: "Polished original draft" };
      }
      else if (/\/api\/tickets\/TKT-\d+$/.test(endpoint)) body = {
        id: "ticket-db-42", ticketId: endpoint.split("/").at(-1), title: "Payroll export fails for October", description: "The customer cannot export the October payroll report.", status: "OPEN_IN_PROGRESS", priority: "HIGH", type: "SUPPORT", project: "Payroll", senderName: "Priya Sharma", senderEmail: "priya@example.test", assignedTo: assignee, createdBy: { id: ADMIN, name: "Support Admin" }, createdAt: NOW, updatedAt: NOW, dueAt: null, teamId: null, team: null, organization: { id: "org-1", name: "Acme Technologies" }, estimatedHours: null, actualHours: null, attachments: [], implementationRequest: null,
      };
      return route.fulfill({ json: body });
    }
    const dist = path.resolve("client/dist");
    let target = path.resolve(dist, `.${url.pathname}`);
    if (!target.startsWith(`${dist}${path.sep}`) || !fs.existsSync(target) || fs.statSync(target).isDirectory()) target = path.join(dist, "index.html");
    const types: Record<string, string> = { ".js": "application/javascript", ".css": "text/css", ".woff2": "font/woff2", ".html": "text/html", ".png": "image/png", ".svg": "image/svg+xml" };
    return route.fulfill({ body: fs.readFileSync(target), contentType: types[path.extname(target)] ?? "application/octet-stream" });
  });
  return { posted, failBulk: () => { bulkFailure = true; }, holdPolish: () => { holdPolish = true; }, releasePolish: () => polishResolve?.() };
}

test("staff queues preserve URL filters, sort and pagination", async ({ page }, info) => {
  await mockStaffApp(page);
  await page.goto("https://right-tracker.local.test/work?queue=overdue");
  await expect(page.getByRole("heading", { name: "Work queues" })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Overdue/ })).toHaveAttribute("aria-pressed", "true");
  await page.getByLabel("Search work queues").fill("payroll");
  await expect(page).toHaveURL(/search=payroll/);
  await page.getByRole("button", { name: "Filters", exact: true }).click();
  await page.getByLabel("Sort tickets").selectOption("dueAt");
  await page.getByRole("button", { name: "Next page", exact: true }).click();
  await expect(page).toHaveURL(/page=2/);
  await page.screenshot({ path: info.outputPath("staff-queues.png"), fullPage: true });
  await page.getByRole("link", { name: /TKT-0042 Payroll/ }).click();
  await expect(page.getByRole("tab", { name: "Conversation" })).toBeVisible();
  await page.getByRole("link", { name: "Back to work queues" }).click();
  await expect(page).toHaveURL(/page=2/);
});

test("bulk company invitations report delivery and retain failed addresses", async ({ page }) => {
  await mockStaffApp(page);
  const addresses: string[] = [];
  await page.route("**/api/organizations", (route) => route.fulfill({ json: [
    { id: "org-1", name: "Acme", slug: "acme", _count: { memberships: 0, tickets: 0 }, memberships: [], invitations: [] },
  ] }));
  await page.route("**/api/organizations/org-1/invitations", (route) => {
    const { email, role } = route.request().postDataJSON();
    expect(role).toBe("MEMBER");
    addresses.push(email);
    if (email === "existing@example.test") {
      return route.fulfill({ status: 409, json: { error: "This email already has an account." } });
    }
    return route.fulfill({ status: 201, json: { email, delivery: "failed", activationUrl: "https://right-tracker.local.test/activate?token=fixture" } });
  });
  await page.goto("https://right-tracker.local.test/organizations");
  await page.getByText("Bulk invitations", { exact: true }).click();
  const input = page.getByLabel("Customer emails", { exact: true });
  await input.fill("invalid");
  await expect(page.getByRole("button", { name: "Send invitations", exact: true })).toBeDisabled();
  await input.fill("New@example.test, new@example.test\nexisting@example.test");
  await page.getByRole("button", { name: "Send invitations", exact: true }).click();
  await expect(page.getByLabel("Activation link for new@example.test")).toHaveValue(/activate/);
  await expect(page.getByText("This email already has an account.")).toBeVisible();
  await expect(input).toHaveValue("existing@example.test");
  expect(addresses).toEqual(["new@example.test", "existing@example.test"]);
});

test("personal saved views and reviewed bulk updates", async ({ page }) => {
  const app = await mockStaffApp(page);
  await page.goto("https://right-tracker.local.test/work?queue=all");
  await page.getByRole("button", { name: "Save view", exact: true }).click();
  await page.getByLabel("View name").fill("Payroll triage");
  await page.getByRole("dialog").getByRole("button", { name: "Save view" }).click();
  await expect(page.getByRole("button", { name: "Payroll triage", exact: true })).toBeVisible();
  await page.getByLabel("Select all tickets on this page").check();
  await page.getByRole("button", { name: "Review change" }).click();
  await expect(page.getByRole("dialog")).toContainText("2 tickets");
  await page.getByRole("button", { name: "Apply change", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("2 tickets updated");
  const bulk = app.posted.find((item) => item.url === "/api/work/bulk");
  expect(JSON.parse(bulk!.body)).toEqual({ ticketIds: ["TKT-0042", "TKT-0043"], change: { field: "priority", value: "HIGH" } });
});

test("failed bulk operations retain selection and display conflict", async ({ page }) => {
  const app = await mockStaffApp(page); app.failBulk();
  await page.goto("https://right-tracker.local.test/work");
  await page.getByLabel("Select all tickets on this page").check();
  await page.getByRole("button", { name: "Review change" }).click();
  await page.getByRole("button", { name: "Apply change", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText("not allowed");
  await expect(page.getByLabel("Select TKT-0042")).toBeChecked();
});

test("ticket workspace keeps public and internal drafts across navigation", async ({ page }, info) => {
  const app = await mockStaffApp(page);
  await page.goto("https://right-tracker.local.test/tickets/TKT-0042?returnTo=%2Fwork%3Fqueue%3Dmine");
  const composer = page.getByPlaceholder("Write a reply…");
  await composer.fill("Customer-safe progress update");
  await page.getByRole("button", { name: "Internal note", exact: true }).click();
  await composer.fill("Private investigation details");
  await page.getByRole("tab", { name: "Activity", exact: true }).click();
  await expect(page.getByText("changed priority from", { exact: false })).toBeVisible();
  await page.getByRole("tab", { name: "Conversation", exact: true }).click();
  await expect(composer).toHaveValue("Private investigation details");
  await page.screenshot({ path: info.outputPath("ticket-workspace.png"), fullPage: true });
  await page.getByRole("link", { name: "Back to work queues" }).click();
  await page.getByRole("link", { name: /TKT-0042 Payroll/ }).click();
  await expect(composer).toHaveValue("Customer-safe progress update");
  await page.getByRole("button", { name: "Internal note", exact: true }).click();
  await expect(composer).toHaveValue("Private investigation details");
  await page.getByRole("button", { name: "Post Reply", exact: true }).click();
  await expect(composer).toHaveValue("");
  await page.getByRole("button", { name: "Public reply", exact: true }).click();
  await expect(composer).toHaveValue("Customer-safe progress update");
  expect(app.posted.find((item) => item.url.endsWith("/comments"))?.body).toContain('name="isInternal"\r\n\r\ntrue');
});

test("agent claims eligible work before replying", async ({ page }) => {
  const app = await mockStaffApp(page, "AGENT");
  await page.goto("https://right-tracker.local.test/tickets/TKT-0042");
  await expect(page.getByPlaceholder("Write a reply…")).toHaveCount(0);
  await page.getByRole("button", { name: "Assign to me", exact: true }).click();
  await expect(page.getByPlaceholder("Write a reply…")).toBeVisible();
  expect(JSON.parse(app.posted.find((item) => item.url.endsWith("/bulk"))!.body).change.value).toBe(AGENT);
  await expect(page.getByLabel("ticket-due")).toHaveCount(0);
});

test("late AI polish cannot replace newer draft text", async ({ page }) => {
  const app = await mockStaffApp(page); app.holdPolish();
  await page.goto("https://right-tracker.local.test/tickets/TKT-0042");
  const composer = page.getByPlaceholder("Write a reply…");
  await composer.fill("Original draft");
  const pending = page.waitForRequest((request) => request.url().endsWith("/polish"));
  await page.getByRole("button", { name: /Polish/ }).click(); await pending;
  await composer.fill("Newer draft typed while AI was working");
  app.releasePolish();
  await expect(page.getByRole("button", { name: /Polish/ })).toBeEnabled();
  await expect(composer).toHaveValue("Newer draft typed while AI was working");
});

test("mobile queue stays within viewport", async ({ page }, info) => {
  await mockStaffApp(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("https://right-tracker.local.test/work");
  await expect(page.getByRole("heading", { name: "Work queues" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await page.screenshot({ path: info.outputPath("staff-mobile.png"), fullPage: true });
});
test("WiseWork client setup opens the matching workspace", async ({ page }) => {
  await mockStaffApp(page);
  const clientId = "00000000-0000-4000-8000-000000000004";
  const workspace = {
    id: "00000000-0000-4000-8000-000000000005", name: "Acme", slug: "acme", hrmsClientId: clientId,
    isActive: true, _count: { memberships: 0, tickets: 0 }, memberships: [], invitations: [],
  };
  let ready = false;
  await page.route("**/api/tickets/clients**", (route) => route.fulfill({ headers: { "x-client-directory-source": "snapshot" }, json: [{ id: clientId, name: "Acme" }] }));
  await page.route("**/api/organizations", (route) => route.fulfill({ json: ready ? [workspace] : [] }));
  await page.route("**/api/organizations/client-setup", (route) => {
    expect(route.request().postDataJSON()).toEqual({ clientId });
    ready = true;
    return route.fulfill({ status: 201, json: workspace });
  });
  await page.goto("https://right-tracker.local.test/clients");
  await expect(page.getByText("Not set up", { exact: true }).last()).toBeVisible();
  await page.getByRole("button", { name: "Set up portal" }).click();
  await expect(page).toHaveURL(new RegExp(`/clients/${workspace.id}$`));
  await expect(page.getByRole("heading", { name: "Acme" })).toBeVisible();
  await expect(page.getByLabel("Customer emails")).toBeVisible();
  await expect(page.getByRole("link", { name: "Client sign-in" })).toHaveAttribute("href", "/portal/login");
  await expect(page.getByRole("link", { name: "View tickets" })).toHaveAttribute("href", `/tickets?organizationId=${workspace.id}&date=all`);
  await page.getByRole("link", { name: "Back to Clients" }).click();
  await expect(page.getByRole("link", { name: "Manage client" })).toBeVisible();
});

test("staff can launch WiseWork sign-in from the login page", async ({ page }) => {
  await mockStaffApp(page);
  await page.route("**/api/auth/get-session", (route) => route.fulfill({ json: null }));
  await page.route("**/api/staff/wisework-sso", (route) => route.fulfill({ status: 503, json: { enabled: false } }));
  await page.route("**/api/auth/sign-in/oauth2", (route) => {
    expect(route.request().postDataJSON()).toMatchObject({
      providerId: "wisework",
      callbackURL: "https://right-tracker.local.test/staff/wisework/complete",
    });
    return route.fulfill({ status: 503, json: { message: "Fixture provider unavailable" } });
  });
  await page.goto("https://right-tracker.local.test/login");
  await page.getByRole("link", { name: "Continue with WiseWork" }).click();
  await expect(page.getByRole("alert")).toContainText("contact your Right Tracker administrator");
});

test("WiseWork completion opens the dashboard for an authenticated active staff account", async ({ page }) => {
  await mockStaffApp(page, "AGENT");
  await page.addInitScript(() => sessionStorage.removeItem("tms_active"));
  await page.goto("https://right-tracker.local.test/staff/wisework/complete");
  await expect(page).toHaveURL("https://right-tracker.local.test/");
  expect(await page.evaluate(() => sessionStorage.getItem("tms_active"))).toBe("1");
});

for (const [supportRole, label] of [
  ["TSA", "Technical Support Admin"],
  ["PROJECT_LEAD", "Project Lead"],
  ["MEMBER", "Member"],
] as const) {
  test(`staff profile displays ${label} from the server role`, async ({ page }) => {
    await mockStaffApp(page, "AGENT");
    await page.route("**/api/staff/support-role", (route) => route.fulfill({ json: { supportRole } }));
    await page.goto("https://right-tracker.local.test/work");
    await expect(page.getByText(label, { exact: true })).toBeVisible();
  });
}

test("internal ticket submits the selected project", async ({ page }) => {
  await mockStaffApp(page, "AGENT");
  await page.route("**/api/internal/projects", (route) => route.fulfill({
    json: { projects: [{ id: "payroll", name: "Payroll" }], projectRequired: true },
  }));
  await page.route("**/api/internal/tickets", (route) => {
    expect(route.request().postDataJSON()).toMatchObject({ projectId: "payroll", title: "Internal payroll issue" });
    return route.fulfill({ status: 201, json: { ticketId: "TKT-0050" } });
  });
  await page.goto("https://right-tracker.local.test/internal/submit");
  await page.getByLabel("Title").fill("Internal payroll issue");
  await page.getByLabel("Project").selectOption("payroll");
  await page.getByLabel("Description").fill("Payroll export needs an internal review.");
  await page.getByRole("button", { name: "Submit Ticket" }).click();
  await expect(page.getByRole("heading", { name: "Ticket Submitted" })).toBeVisible();
});

test("TSA sees ticket reports and can edit a ticket without admin menus", async ({ page }) => {
  await mockStaffApp(page, "AGENT");
  await page.route("**/api/staff/support-role", (route) => route.fulfill({ json: { supportRole: "TSA" } }));
  const ticketUrl = "https://right-tracker.local.test/tickets/TKT-0042";
  await page.route("**/api/tickets/TKT-0042", (route) => route.fulfill({ json: {
    id: "ticket-db-42", ticketId: "TKT-0042", title: "Payroll export fails", description: "Export did not finish.",
    status: "OPEN_IN_PROGRESS", priority: "HIGH", type: "SUPPORT", project: "Payroll",
    senderName: "Priya", senderEmail: "priya@example.test", assignedTo: null,
    createdBy: { id: ADMIN, name: "Support Admin" }, createdAt: NOW, updatedAt: NOW, attachments: [],
    supportPermissions: { manage: true, assign: true, note: true, reply: true },
  } }));
  await page.route("**/api/tickets/TKT-0042/details", (route) => {
    expect(route.request().postDataJSON()).toMatchObject({ title: "Updated payroll issue" });
    return route.fulfill({ status: 204 });
  });
  await page.goto(ticketUrl);
  await expect(page.getByRole("link", { name: "Analytics", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Employee directory", exact: true })).toHaveCount(0);
  await page.getByText("Edit ticket details", { exact: true }).click();
  await page.getByLabel("Title", { exact: true }).fill("Updated payroll issue");
  await page.getByRole("button", { name: "Save ticket details" }).click();
  await expect(page.getByText("Ticket details saved.")).toBeVisible();
});

test("staff credentials appear only after choosing Right Tracker sign in", async ({ page }) => {
  await mockStaffApp(page);
  await page.route("**/api/auth/get-session", (route) => route.fulfill({ json: null }));
  await page.goto("https://right-tracker.local.test/login?returnTo=%2Ftickets");
  await expect(page.getByRole("link", { name: "Continue with WiseWork" })).toBeVisible();
  await expect(page.getByLabel("Email address")).toHaveCount(0);
  await page.getByRole("link", { name: "Sign in", exact: true }).click();
  await expect(page.getByLabel("Email address")).toBeVisible();
  await expect(page.getByLabel("Password", { exact: true })).toBeVisible();
  expect(new URL(page.url()).searchParams.get("returnTo")).toBe("/tickets");
  await page.getByRole("link", { name: "Back to staff sign-in options" }).click();
  await expect(page.getByLabel("Email address")).toHaveCount(0);
});

test("TSA can open client onboarding while administration stays hidden", async ({ page }) => {
  await mockStaffApp(page, "AGENT");
  await page.route("**/api/staff/support-role", (route) => route.fulfill({ json: { supportRole: "TSA" } }));
  await page.route("**/api/tickets/clients", (route) => route.fulfill({ json: [] }));
  await page.route("**/api/organizations", (route) => route.fulfill({ json: [
    { id: "org-1", name: "Acme", slug: "acme", _count: { memberships: 0, tickets: 0 }, memberships: [], invitations: [] },
  ] }));
  await page.goto("https://right-tracker.local.test/work");
  await page.getByRole("link", { name: "Clients", exact: true }).click();
  await page.getByRole("link", { name: "Manage client" }).click();
  await expect(page.getByRole("heading", { name: "Acme" })).toBeVisible();
  await expect(page.getByLabel("Customer emails")).toBeVisible();
  await expect(page.getByRole("link", { name: "Employee directory", exact: true })).toHaveCount(0);
});
