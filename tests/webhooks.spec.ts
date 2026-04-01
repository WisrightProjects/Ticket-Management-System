import { test, expect, type APIRequestContext } from "@playwright/test";

// ---------------------------------------------------------------------------
// Config — read from env (loaded into process.env by playwright.config.ts)
// ---------------------------------------------------------------------------

const BASE = process.env.TEST_BACKEND_URL ?? "http://localhost:5001";
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET ?? "";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function postEmail(
  request: APIRequestContext,
  body: Record<string, unknown>,
  secret = WEBHOOK_SECRET
) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (secret) headers["Authorization"] = `Bearer ${secret}`;
  return request.post(`${BASE}/api/webhooks/email`, { data: body, headers });
}

function ticketNum(ticketId: string) {
  return parseInt(ticketId.replace("TKT-", ""), 10);
}

// ---------------------------------------------------------------------------
// Suite — serial: ticket IDs increment across tests
// ---------------------------------------------------------------------------

test.describe.configure({ mode: "serial" });

test.describe("POST /api/webhooks/email", () => {

  // ─── Happy path ───────────────────────────────────────────────────────────

  test("creates a ticket and returns 201 with ticketId and id", async ({ request }) => {
    const res = await postEmail(request, {
      from: "client@example.com",
      name: "Alice",
      subject: "Login page broken",
      body: "The login button does nothing on Chrome.",
    });

    expect(res.status()).toBe(201);
    const json = await res.json();
    expect(json.ticketId).toMatch(/^TKT-\d{4}$/);
    expect(typeof json.id).toBe("string");
    expect(json.id.length).toBeGreaterThan(0);
  });

  test("name field is optional — creates ticket without it", async ({ request }) => {
    const res = await postEmail(request, {
      from: "noreply@example.com",
      subject: "No name provided",
      body: "Just a body.",
    });

    expect(res.status()).toBe(201);
    const json = await res.json();
    expect(json.ticketId).toMatch(/^TKT-\d{4}$/);
  });

  // ─── Ticket ID format ─────────────────────────────────────────────────────

  test("ticketId is always zero-padded to 4 digits (TKT-XXXX)", async ({ request }) => {
    const res = await postEmail(request, {
      from: "format@example.com",
      subject: "ID format check",
      body: "Verify zero padding.",
    });

    expect(res.status()).toBe(201);
    const { ticketId } = await res.json();
    // Must match TKT- followed by exactly 4 digits
    expect(ticketId).toMatch(/^TKT-\d{4}$/);
  });

  test("sequential IDs — 5 back-to-back requests produce strictly consecutive numbers", async ({ request }) => {
    const ids: number[] = [];
    for (let i = 0; i < 5; i++) {
      const res = await postEmail(request, {
        from: `user${i}@example.com`,
        subject: `Sequential ticket ${i}`,
        body: `Body ${i}`,
      });
      expect(res.status()).toBe(201);
      const { ticketId } = await res.json();
      ids.push(ticketNum(ticketId));
    }

    // All 5 are unique
    expect(new Set(ids).size).toBe(5);
    // Numbers are consecutive with no gaps
    for (let i = 1; i < ids.length; i++) {
      expect(ids[i]).toBe(ids[i - 1] + 1);
    }
  });

  // ─── Duplicate emails (no deduplication) ──────────────────────────────────

  test("same from + subject + body sent twice → two separate tickets", async ({ request }) => {
    const payload = {
      from: "dup@example.com",
      name: "Bob",
      subject: "Duplicate subject",
      body: "Exact same body.",
    };

    const res1 = await postEmail(request, payload);
    const res2 = await postEmail(request, payload);

    expect(res1.status()).toBe(201);
    expect(res2.status()).toBe(201);

    const t1 = await res1.json();
    const t2 = await res2.json();

    // Different ticket IDs — no deduplication
    expect(t1.ticketId).not.toBe(t2.ticketId);
    // Different record IDs
    expect(t1.id).not.toBe(t2.id);
    // Sequential
    expect(ticketNum(t2.ticketId)).toBe(ticketNum(t1.ticketId) + 1);
  });

  test("same sender, different subject → two separate tickets", async ({ request }) => {
    const res1 = await postEmail(request, {
      from: "same@example.com",
      subject: "Issue A",
      body: "First issue.",
    });
    const res2 = await postEmail(request, {
      from: "same@example.com",
      subject: "Issue B",
      body: "Second issue.",
    });

    expect(res1.status()).toBe(201);
    expect(res2.status()).toBe(201);

    const t1 = await res1.json();
    const t2 = await res2.json();
    expect(t1.ticketId).not.toBe(t2.ticketId);
  });

  test("same subject, different sender → two separate tickets", async ({ request }) => {
    const res1 = await postEmail(request, {
      from: "sender1@example.com",
      subject: "Same subject",
      body: "Body from sender one.",
    });
    const res2 = await postEmail(request, {
      from: "sender2@example.com",
      subject: "Same subject",
      body: "Body from sender two.",
    });

    expect(res1.status()).toBe(201);
    expect(res2.status()).toBe(201);

    const t1 = await res1.json();
    const t2 = await res2.json();
    expect(t1.ticketId).not.toBe(t2.ticketId);
  });

  // ─── Subject boundary lengths ─────────────────────────────────────────────

  test("subject at exactly 1 character is valid", async ({ request }) => {
    const res = await postEmail(request, {
      from: "client@example.com",
      subject: "X",
      body: "Body text.",
    });
    expect(res.status()).toBe(201);
  });

  test("subject at exactly 255 characters is valid", async ({ request }) => {
    const res = await postEmail(request, {
      from: "client@example.com",
      subject: "A".repeat(255),
      body: "Body text.",
    });
    expect(res.status()).toBe(201);
  });

  test("subject at 256 characters is rejected with 400", async ({ request }) => {
    const res = await postEmail(request, {
      from: "client@example.com",
      subject: "A".repeat(256),
      body: "Body text.",
    });
    expect(res.status()).toBe(400);
    const json = await res.json();
    expect(json.fieldErrors).toHaveProperty("subject");
  });

  // ─── Email address formats ────────────────────────────────────────────────

  test("plus-addressed email (user+tag@domain.com) is accepted", async ({ request }) => {
    const res = await postEmail(request, {
      from: "support+client123@example.com",
      subject: "Plus addressed email",
      body: "Test body.",
    });
    expect(res.status()).toBe(201);
  });

  test("subdomain email is accepted", async ({ request }) => {
    const res = await postEmail(request, {
      from: "user@mail.subdomain.example.com",
      subject: "Subdomain sender",
      body: "Test body.",
    });
    expect(res.status()).toBe(201);
  });

  // ─── Special characters & encoding ────────────────────────────────────────

  test("HTML tags in subject and body are stored as plain text — not executed", async ({ request }) => {
    const res = await postEmail(request, {
      from: "html@example.com",
      subject: "<script>alert('xss')</script>",
      body: "<b>Bold</b> and <img src=x onerror=alert(1)>",
    });
    // Server stores it as-is — no sanitization, no execution, no crash
    expect(res.status()).toBe(201);
  });

  test("SQL injection attempt in subject is stored safely", async ({ request }) => {
    const res = await postEmail(request, {
      from: "sqli@example.com",
      subject: "'; DROP TABLE tickets; --",
      body: "SELECT * FROM users WHERE 1=1",
    });
    expect(res.status()).toBe(201);
  });

  test("unicode and emoji in subject and body are accepted", async ({ request }) => {
    const res = await postEmail(request, {
      from: "unicode@example.com",
      subject: "Bug report 🐛 — página de início",
      body: "Descripción del problema: el botón no funciona 😢\n日本語テスト",
    });
    expect(res.status()).toBe(201);
  });

  test("newlines and tabs in body are accepted", async ({ request }) => {
    const res = await postEmail(request, {
      from: "multiline@example.com",
      subject: "Multi-line body",
      body: "Line one.\nLine two.\n\tIndented line three.",
    });
    expect(res.status()).toBe(201);
  });

  // ─── Body size limit ──────────────────────────────────────────────────────

  test("body larger than 50 kb is rejected (Express body size limit)", async ({ request }) => {
    const res = await postEmail(request, {
      from: "large@example.com",
      subject: "Large body test",
      // 52 kb of text
      body: "x".repeat(52 * 1024),
    });
    // Express rejects with 413 before the route handler runs
    expect(res.status()).toBe(413);
  });

  // ─── Validation errors ────────────────────────────────────────────────────

  test("returns 400 when from is missing", async ({ request }) => {
    const res = await postEmail(request, { subject: "No from field", body: "Body text" });
    expect(res.status()).toBe(400);
    expect((await res.json()).fieldErrors).toHaveProperty("from");
  });

  test("returns 400 when from is not a valid email", async ({ request }) => {
    const res = await postEmail(request, { from: "not-an-email", subject: "Bad email", body: "Body text" });
    expect(res.status()).toBe(400);
    expect((await res.json()).fieldErrors).toHaveProperty("from");
  });

  test("returns 400 when subject is missing", async ({ request }) => {
    const res = await postEmail(request, { from: "client@example.com", body: "Body text" });
    expect(res.status()).toBe(400);
    expect((await res.json()).fieldErrors).toHaveProperty("subject");
  });

  test("returns 400 when subject is empty string", async ({ request }) => {
    const res = await postEmail(request, { from: "client@example.com", subject: "", body: "Body text" });
    expect(res.status()).toBe(400);
    expect((await res.json()).fieldErrors).toHaveProperty("subject");
  });

  test("returns 400 when body is missing", async ({ request }) => {
    const res = await postEmail(request, { from: "client@example.com", subject: "No body field" });
    expect(res.status()).toBe(400);
    expect((await res.json()).fieldErrors).toHaveProperty("body");
  });

  test("returns 400 when body is empty string", async ({ request }) => {
    const res = await postEmail(request, { from: "client@example.com", subject: "Empty body", body: "" });
    expect(res.status()).toBe(400);
    expect((await res.json()).fieldErrors).toHaveProperty("body");
  });

  test("returns 400 when the entire payload is empty", async ({ request }) => {
    const res = await postEmail(request, {});
    expect(res.status()).toBe(400);
    const json = await res.json();
    expect(json.fieldErrors).toHaveProperty("from");
    expect(json.fieldErrors).toHaveProperty("subject");
    expect(json.fieldErrors).toHaveProperty("body");
  });

  // ─── Secret guard ─────────────────────────────────────────────────────────

  test("passes through when WEBHOOK_SECRET is not configured", async ({ request }) => {
    const res = await postEmail(request, {
      from: "anon@example.com",
      subject: "No auth header needed",
      body: "Secret is not configured so this should work.",
    }, "" /* force no header */);

    const expected = WEBHOOK_SECRET ? 401 : 201;
    expect(res.status()).toBe(expected);
  });

  test("returns 401 when Authorization header has a wrong secret", async ({ request }) => {
    const res = await request.post(`${BASE}/api/webhooks/email`, {
      data: { from: "x@example.com", subject: "Test", body: "Body" },
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer definitely-wrong-secret",
      },
    });

    const expected = WEBHOOK_SECRET ? 401 : 201;
    expect(res.status()).toBe(expected);
  });

  test("returns 401 when Authorization header is present but empty", async ({ request }) => {
    const res = await request.post(`${BASE}/api/webhooks/email`, {
      data: { from: "x@example.com", subject: "Test", body: "Body" },
      headers: {
        "Content-Type": "application/json",
        Authorization: "",
      },
    });

    const expected = WEBHOOK_SECRET ? 401 : 201;
    expect(res.status()).toBe(expected);
  });

  test("returns 401 when token uses wrong scheme (Basic instead of Bearer)", async ({ request }) => {
    const res = await request.post(`${BASE}/api/webhooks/email`, {
      data: { from: "x@example.com", subject: "Test", body: "Body" },
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${WEBHOOK_SECRET || "somesecret"}`,
      },
    });

    const expected = WEBHOOK_SECRET ? 401 : 201;
    expect(res.status()).toBe(expected);
  });
});
