import { test, expect } from "@playwright/test";

const BASE = process.env.TEST_BACKEND_URL ?? "http://localhost:5001";

test("staff queues: atomic edits, claims, team permissions, deadlines and private views", async ({ playwright }) => {
  const admin = await playwright.request.newContext({ baseURL: BASE });
  const agent = await playwright.request.newContext({ baseURL: BASE });
  const other = await playwright.request.newContext({ baseURL: BASE });
  try {
    expect((await admin.post("/api/auth/sign-in/email", { data: { email: "admin@wisright.com", password: "Test@123" } })).ok()).toBeTruthy();
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const password = "StaffFixtureOnly123!";
    const makeAgent = async (name: string) => {
      const email = `${name}-${suffix}@example.test`;
      const response = await admin.post("/api/users", { data: { name, email, password, role: "AGENT" } });
      expect(response.status()).toBe(201);
      return { ...(await response.json()), email };
    };
    const firstAgent = await makeAgent("first-agent");
    const secondAgent = await makeAgent("second-agent");
    expect((await agent.post("/api/auth/sign-in/email", { data: { email: firstAgent.email, password } })).ok()).toBeTruthy();
    expect((await other.post("/api/auth/sign-in/email", { data: { email: secondAgent.email, password } })).ok()).toBeTruthy();
    const teamResponse = await admin.post("/api/work/teams", { data: { name: `Support ${suffix}`, memberIds: [firstAgent.id] } });
    expect(teamResponse.status()).toBe(201);
    const team = await teamResponse.json();
    const makeTicket = async (title: string) => {
      const response = await admin.post("/api/internal/tickets", { data: { title, description: "Local staff integration fixture", type: "SUPPORT", priority: "MEDIUM" } });
      expect(response.status()).toBe(201);
      return (await response.json()).ticketId as string;
    };
    const first = await makeTicket(`First ${suffix}`);
    const second = await makeTicket(`Second ${suffix}`);
    const bulk = (ticketIds: string[], change: object) => admin.post("/api/work/bulk", { data: { ticketIds, change } });
    expect((await bulk([first, second], { field: "teamId", value: team.id })).status()).toBe(200);
    expect((await bulk([first], { field: "assignedToId", value: firstAgent.id })).status()).toBe(200);
    expect((await bulk([first], { field: "status", value: "OPEN_NOT_STARTED" })).status()).toBe(200);

    // First transition is legal, second is not: neither may be written.
    expect((await bulk([first, second], { field: "status", value: "OPEN_IN_PROGRESS" })).status()).toBe(409);
    expect((await (await admin.get(`/api/tickets/${first}`)).json()).status).toBe("OPEN_NOT_STARTED");
    expect((await (await admin.get(`/api/tickets/${second}`)).json()).status).toBe("UN_ASSIGNED");
    expect((await agent.post("/api/work/bulk", { data: { ticketIds: [first, second], change: { field: "priority", value: "HIGH" } } })).status()).toBe(403);
    expect((await (await admin.get(`/api/tickets/${first}`)).json()).priority).toBe("MEDIUM");
    expect((await other.patch(`/api/tickets/${first}/priority`, { data: { priority: "HIGH" } })).status()).toBe(403);
    expect((await other.post("/api/work/bulk", { data: { ticketIds: [second], change: { field: "assignedToId", value: secondAgent.id } } })).status()).toBe(403);
    expect((await agent.post("/api/work/bulk", { data: { ticketIds: [second], change: { field: "assignedToId", value: firstAgent.id } } })).status()).toBe(200);

    const dueAt = new Date(Date.now() - 86400000).toISOString();
    expect((await bulk([first], { field: "dueAt", value: dueAt })).status()).toBe(200);
    const overdue = await (await admin.get("/api/work/queue?queue=overdue")).json();
    expect(overdue.data.some((row: { ticketId: string }) => row.ticketId === first)).toBeTruthy();
    expect((await agent.post("/api/work/bulk", { data: { ticketIds: [first], change: { field: "dueAt", value: null } } })).status()).toBe(403);
    expect((await admin.put(`/api/work/teams/${team.id}/members`, { data: { memberIds: [] } })).status()).toBe(409);
    expect((await agent.post("/api/work/teams", { data: { name: "Unauthorized team" } })).status()).toBe(403);
    expect((await agent.get("/api/work/queue?pageSize=5000")).status()).toBe(400);

    const viewResponse = await agent.post("/api/work/views", { data: { name: `My view ${suffix}`, filters: { queue: "mine", priority: "HIGH" } } });
    expect(viewResponse.status()).toBe(201);
    const view = await viewResponse.json();
    expect((await other.delete(`/api/work/views/${view.id}`)).status()).toBe(404);
    expect((await agent.delete(`/api/work/views/${view.id}`)).status()).toBe(204);

    expect((await admin.patch(`/api/tickets/${first}/estimated-hours`, { data: { estimatedHours: 1.25 } })).status()).toBe(200);
    const history = await (await admin.get(`/api/tickets/${first}/history`)).json();
    expect(history.some((event: { field: string; newValue: string }) => event.field === "estimatedHours" && event.newValue === "1.25")).toBeTruthy();
    expect((await admin.post(`/api/tickets/${first}/comments`, { multipart: { content: "Investigation note", isInternal: "true" } })).status()).toBe(201);
    const comments = await (await agent.get(`/api/tickets/${first}/comments`)).json();
    expect(comments.some((comment: { content: string; isInternal: boolean }) => comment.content === "Investigation note" && comment.isInternal)).toBeTruthy();
    expect((await bulk([first], { field: "status", value: "OPEN_IN_PROGRESS" })).status()).toBe(200);
    expect((await bulk([first], { field: "status", value: "OPEN_DONE" })).status()).toBe(400);
    expect((await bulk([first], { field: "status", value: "OPEN_DONE", resolutionSummary: "Verified payroll export after fixing the configuration." })).status()).toBe(200);
    const after = await (await admin.get("/api/work/queue?queue=overdue")).json();
    expect(after.data.some((row: { ticketId: string }) => row.ticketId === first)).toBeFalsy();
  } finally { await Promise.all([admin.dispose(), agent.dispose(), other.dispose()]); }
});

test("staff endpoints require authentication and reject malformed payloads", async ({ request }) => {
  expect((await request.get(`${BASE}/api/work/queue`)).status()).toBe(401);
  expect((await request.get(`${BASE}/api/work/options`)).status()).toBe(401);
  expect((await request.post(`${BASE}/api/work/bulk`, { data: {} })).status()).toBe(401);
});
