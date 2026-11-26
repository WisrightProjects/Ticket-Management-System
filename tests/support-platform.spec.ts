import { test, expect } from "@playwright/test";

const BASE = process.env.TEST_BACKEND_URL ?? "http://localhost:5001";

test.describe("Organization onboarding and customer privacy", () => {
  test("invitation activation, requester isolation, internal notes and transitions", async ({ playwright }) => {
    const admin = await playwright.request.newContext({ baseURL: BASE });
    const customer = await playwright.request.newContext({ baseURL: BASE });
    const outsider = await playwright.request.newContext({ baseURL: BASE });
    try {
      expect((await admin.post("/api/auth/sign-in/email", { data: { email: "admin@wisright.com", password: "Test@123" } })).ok()).toBeTruthy();
      const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const organizationResponse = await admin.post("/api/organizations", { data: { name: "Platform test", slug: `platform-${suffix}` } });
      expect(organizationResponse.status()).toBe(201);
      const organization = await organizationResponse.json();
      const email = `customer-${suffix}@example.test`;
      const invitationResponse = await admin.post(`/api/organizations/${organization.id}/invitations`, { data: { email } });
      expect(invitationResponse.status()).toBe(201);
      const invitation = await invitationResponse.json();
      const token = new URL(invitation.activationUrl).searchParams.get("token");
      const activation = { token, name: "Customer test", password: "CustomerTest123!" };
      expect((await customer.post("/api/onboarding/activate", { data: activation })).status()).toBe(201);
      expect((await customer.post("/api/onboarding/activate", { data: activation })).status()).toBe(409);
      expect((await customer.post("/api/auth/sign-in/email", { data: { email, password: activation.password } })).ok()).toBeTruthy();
      const context = await (await customer.get("/api/portal/me")).json();
      expect(context.memberships[0].organization.id).toBe(organization.id);
      expect((await customer.patch("/api/portal/me/client", { data: { clientId: "another-company" } })).status()).toBe(403);
      expect((await customer.get("/api/organizations")).status()).toBe(403);
      expect((await customer.get("/api/work/queue")).status()).toBe(403);
      expect((await customer.post("/api/work/bulk", { data: {} })).status()).toBe(403);
      const submitted = await customer.post("/api/portal/requests", { multipart: { organizationId: organization.id, subject: "Export not working", body: "October payroll export fails with an error", category: "BUG" } });
      expect(submitted.status()).toBe(201);
      const ticket = await submitted.json();
      expect((await customer.get(`/api/portal/tickets/${ticket.ticketId}`)).status()).toBe(200);
      expect((await admin.patch(`/api/tickets/${ticket.ticketId}/status`, { data: { status: "CLOSED" } })).status()).toBe(400);
      expect((await admin.patch(`/api/tickets/${ticket.ticketId}/status`, { data: { status: "OPEN_NOT_STARTED" } })).status()).toBe(200);
      expect((await admin.post(`/api/tickets/${ticket.ticketId}/comments`, { multipart: { content: "Private investigation note", isInternal: "true" } })).status()).toBe(201);
      const comments = await (await customer.get(`/api/portal/tickets/${ticket.ticketId}/comments`)).json();
      expect(comments.some((c: { content: string }) => c.content === "Private investigation note")).toBeFalsy();
      const otherResponse = await admin.post("/api/organizations", { data: { name: "Other company", slug: `other-${suffix}` } });
      const other = await otherResponse.json();
      const otherEmail = `outsider-${suffix}@example.test`;
      const otherInvite = await (await admin.post(`/api/organizations/${other.id}/invitations`, { data: { email: otherEmail } })).json();
      expect((await outsider.post("/api/onboarding/activate", { data: { token: new URL(otherInvite.activationUrl).searchParams.get("token"), name: "Other customer", password: activation.password } })).status()).toBe(201);
      expect((await outsider.post("/api/auth/sign-in/email", { data: { email: otherEmail, password: activation.password } })).ok()).toBeTruthy();
      expect((await outsider.get(`/api/portal/tickets/${ticket.ticketId}`)).status()).toBe(404);
      expect((await outsider.post(`/api/portal/tickets/${ticket.ticketId}/comments`, { multipart: { content: "Unauthorized reply" } })).status()).toBe(404);
      expect((await outsider.post("/api/portal/requests", { multipart: { organizationId: organization.id, subject: "Forged organization", body: "Unauthorized request" } })).status()).toBe(403);
      expect((await customer.get("/api/portal/tickets?status=NOT_A_STATUS")).status()).toBe(400);
    } finally { await Promise.all([admin.dispose(), customer.dispose(), outsider.dispose()]); }
  });

  test("public signup and malformed invitations fail closed", async ({ request }) => {
    expect((await request.post(`${BASE}/api/portal/auth/signup`, { data: { name: "Uninvited", email: "uninvited@example.test", password: "CustomerTest123!" } })).status()).toBe(403);
    expect((await request.get(`${BASE}/api/onboarding/invitation?token=invalid`)).status()).toBe(400);
    expect((await request.get(`${BASE}/uploads/unknown.png`)).status()).toBe(401);
    expect((await request.post(`${BASE}/api/organizations`, { data: { name: "Unauthorized", slug: "unauthorized" } })).status()).toBe(401);
  });
});
