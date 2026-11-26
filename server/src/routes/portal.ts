import { Router, type Request, type Response } from "express";
import { randomUUID, createHmac, timingSafeEqual, randomBytes } from "node:crypto";
import path from "node:path";
import rateLimit from "express-rate-limit";
import multer from "multer";
import {
  portalSubmitSchema,
  portalRatingSchema,
  createCommentSchema,
  implementationSubmitSchema,
  implementationRejectSchema,
  TICKET_TYPE,
  PRIORITY,
  STATUS,
  ROLES,
} from "@tms/core";
import prisma from "../lib/prisma.js";
import { getClientBySlug, getClientProjects } from "../lib/hrms.js";
import { requireCustomer } from "../middleware/customerAuth.js";
import {
  sendImplementationRequestSubmittedEmail,
  sendImplementationApprovedEmail,
  sendImplementationRejectedEmail,
  sendTicketReopenedEmail,
} from "../lib/mailer.js";
import { Prisma } from "../generated/prisma/client.js";
import { runImageUpload as runUpload, validateMagicBytes } from "../lib/upload.js";
import fs from "node:fs";

const router = Router();

// Wrap multer's callback API into a Promise so we can use await in async routes

const isProd = process.env.NODE_ENV === "production";

// Stricter rate limit for signup — prevents email enumeration
const signupLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProd ? 10 : 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many signup attempts. Please try again later." },
});

// Prevent ticket spam on public submission endpoint
const submitLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: isProd ? 5 : 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many submissions. Please try again later." },
});

// L7 — rate limit public project list endpoint (prevents HRMS enumeration)
const projectsLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: isProd ? 30 : 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please try again later." },
});

// Slim select shape for portal ticket responses — no full description returned
const PORTAL_TICKET_SELECT = {
  id:              true,
  ticketId:        true,
  title:           true,
  description:     true,
  status:          true,
  priority:        true,
  type:            true,
  project:         true,
  hrmsClientId:    true,
  hrmsClientName:  true,
  hrmsProjectId:   true,
  hrmsProjectName: true,
  rating:          true,
  ratingText:      true,
  senderName:      true,
  senderEmail:     true,
  createdAt:       true,
  updatedAt:       true,
  assignedTo:      { select: { name: true } },
  attachments:     { where: { OR: [{ commentId: null }, { comment: { isInternal: false } }] }, select: { id: true, filename: true, mimetype: true, size: true, filepath: true, createdAt: true } },
  implementationRequest: {
    select: {
      businessGoal:            true,
      currentPain:             true,
      expectedOutcome:         true,
      targetDate:              true,
      planContent:             true,
      planPostedAt:            true,
      customerApprovedAt:      true,
      customerRejectedAt:      true,
      customerRejectionReason: true,
    },
  },
} satisfies Prisma.TicketSelect;

// H7 — strip characters that could cause stored XSS via filename display
function sanitizeFilename(name: string): string {
  return name.replace(/[<>"'&/\\]/g, "_").slice(0, 255);
}

// ── M11 — Server-side CAPTCHA helpers ─────────────────────────────────────────

// C-2 — must not fall back to a hardcoded string; use BETTER_AUTH_SECRET as fallback (always set)
const CAPTCHA_SECRET: string = (() => {
  const s = process.env.CAPTCHA_SECRET ?? process.env.BETTER_AUTH_SECRET;
  if (!s) throw new Error("CAPTCHA_SECRET or BETTER_AUTH_SECRET environment variable must be set");
  return s;
})();
const CAPTCHA_CHARS  = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
const CAPTCHA_LEN    = 5;

function generateCaptchaCode(): string {
  const bytes = randomBytes(CAPTCHA_LEN);
  return Array.from(bytes, (b) => CAPTCHA_CHARS[b % CAPTCHA_CHARS.length]).join("");
}

// XOR-encrypt code using keystream derived from HMAC(ts, CAPTCHA_SECRET)
function encryptCode(code: string, ts: string): string {
  const keyStream = createHmac("sha256", CAPTCHA_SECRET).update(ts).digest();
  const codeBytes = Buffer.from(code, "utf8");
  return Buffer.from(codeBytes.map((b, i) => b ^ keyStream[i])).toString("hex");
}

function decryptCode(encryptedCode: string, ts: string): string {
  const keyStream = createHmac("sha256", CAPTCHA_SECRET).update(ts).digest();
  const encrypted = Buffer.from(encryptedCode, "hex");
  return Buffer.from(encrypted.map((b, i) => b ^ keyStream[i])).toString("utf8");
}

function signCaptcha(ts: string, encryptedCode: string): string {
  return createHmac("sha256", CAPTCHA_SECRET)
    .update(`${ts}:${encryptedCode}`)
    .digest("hex");
}

// Single-use enforcement — prevents token replay within the 10-min validity window
const usedCaptchaSignatures = new Set<string>();
function markCaptchaUsed(sig: string): void {
  usedCaptchaSignatures.add(sig);
  setTimeout(() => usedCaptchaSignatures.delete(sig), 5 * 60 * 1000 + 5000);
}

export function verifyCaptchaToken(token: string, answer: string): boolean {
  if (!token || !answer) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [ts, encryptedCode, sig] = parts;
  if (Date.now() - parseInt(ts, 10) > 5 * 60 * 1000) return false;
  if (usedCaptchaSignatures.has(sig)) return false;
  const expected = signCaptcha(ts, encryptedCode);
  let valid = false;
  try {
    valid = timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(expected, "hex"));
  } catch { return false; }
  if (!valid) return false;
  let recovered: string;
  try { recovered = decryptCode(encryptedCode, ts); } catch { return false; }
  if (recovered.toLowerCase() !== answer.toLowerCase().trim()) return false;
  markCaptchaUsed(sig);
  return true;
}

const captchaLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: isProd ? 30 : 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many captcha requests." },
});

// ──────────────────────────────────────
// POST /api/portal/auth/signup — public
// Create a new CUSTOMER account
// ──────────────────────────────────────
router.post("/auth/signup", signupLimiter, (_req, res) => {
 res.status(403).json({ error: "Ask your administrator for an invitation to set up your account" });
});

// PATCH /api/portal/me/client — update the logged-in customer's portal client association
// Called after login to bind the session to the portal they're accessing
router.patch("/me/client", requireCustomer, async (_req, res) => {
 res.status(403).json({ error: "Organization membership is managed by your administrator" });
});

// GET /api/portal/dashboard — summary stats for the logged-in customer
// ──────────────────────────────────────
// Dashboard and request listing are handled by customer-workspace.ts using membership predicates.

router.get("/tickets/:id", requireCustomer, async (req: Request<{ id: string }>, res: Response) => {
  const ticket = await prisma.ticket.findUnique({
    where:  { ticketId: req.params.id },
    select: {
      ...PORTAL_TICKET_SELECT,
      _count: { select: { comments: true } },
    },
  });

  if (!ticket) {
    res.status(404).json({ error: "Ticket not found" });
    return;
  }

  if (req.method !== "GET" && ticket.senderEmail !== req.user!.email) {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  res.json({
    ...ticket,
    assignedTo: ticket.assignedTo ? { name: "Support Team" } : null,
    attachments: ticket.attachments.map((a) => ({
      id:        a.id,
      filename:  a.filename,
      mimetype:  a.mimetype,
      size:      a.size,
      url:       "/uploads/" + path.basename(a.filepath),
      createdAt: a.createdAt,
    })),
  });
});

// ──────────────────────────────────────
// GET /api/portal/tickets/:id/comments
// ──────────────────────────────────────
router.get("/tickets/:id/comments", requireCustomer, async (req: Request<{ id: string }>, res: Response) => {
  const ticket = await prisma.ticket.findUnique({
    where:  { ticketId: req.params.id },
    select: { id: true, senderEmail: true },
  });

  if (!ticket) {
    res.status(404).json({ error: "Ticket not found" });
    return;
  }

  if (req.method !== "GET" && ticket.senderEmail !== req.user!.email) {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  const comments = await prisma.comment.findMany({
    where:   { ticketId: ticket.id, isInternal: false },
    select:  {
      id:          true,
      content:     true,
      senderType:  true,
      author:      { select: { name: true } },
      createdAt:   true,
      attachments: { select: { id: true, filename: true, mimetype: true, size: true, filepath: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  res.json(comments.map((c) => ({
    ...c,
    author: c.senderType === "AGENT" ? { name: "Support Team" } : c.author,
    attachments: c.attachments.map((a) => ({
      id:       a.id,
      filename: a.filename,
      mimetype: a.mimetype,
      size:     a.size,
      url:      "/uploads/" + path.basename(a.filepath),
    })),
  })));
});

// ──────────────────────────────────────
// POST /api/portal/tickets/:id/comments
// ──────────────────────────────────────
router.post("/tickets/:id/comments", requireCustomer, async (req: Request<{ id: string }>, res: Response) => {
  // Run multer to parse multipart/form-data (files + text fields)
  try {
    await runUpload(req, res);
  } catch (err: unknown) {
    const isMulterError = err instanceof multer.MulterError;
    if (isMulterError && (err as multer.MulterError).code === "LIMIT_FILE_SIZE") {
      res.status(400).json({ error: "Each image must be under 1MB" });
      return;
    }
    if (isMulterError && (err as multer.MulterError).code === "LIMIT_FILE_COUNT") {
      res.status(400).json({ error: "Maximum 5 images allowed" });
      return;
    }
    res.status(400).json({ error: err instanceof Error ? err.message : "File upload error" });
    return;
  }

  const parsed = createCommentSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ fieldErrors: parsed.error.flatten().fieldErrors });
    return;
  }

  const ticket = await prisma.ticket.findUnique({
    where:  { ticketId: req.params.id },
    select: { id: true, senderEmail: true },
  });

  if (!ticket) {
    res.status(404).json({ error: "Ticket not found" });
    return;
  }

  if (req.method !== "GET" && ticket.senderEmail !== req.user!.email) {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  const [comment] = await Promise.all([
    prisma.comment.create({
      data: {
        content:    parsed.data.content,
        senderType: "CUSTOMER",
        ticketId:   ticket.id,
        authorId:   req.user!.id,
      },
      select: {
        id:          true,
        content:     true,
        senderType:  true,
        author:      { select: { name: true } },
        createdAt:   true,
        attachments: { select: { id: true, filename: true, mimetype: true, size: true, filepath: true } },
      },
    }),
    prisma.ticket.update({ where: { id: ticket.id }, data: { updatedAt: new Date() } }),
  ]);

  // H-3 — magic byte validation: reject any file whose actual bytes do not
  // match a known image signature, even if the extension/MIME passed the gate.
  const uploadedFiles = req.files as Express.Multer.File[] | undefined;
  if (uploadedFiles && uploadedFiles.length > 0) {
    for (const f of uploadedFiles) {
      const valid = await validateMagicBytes(f.path);
      if (!valid) {
        // Delete all uploaded files for this request before rejecting
        await Promise.all(
          uploadedFiles.map((u) => fs.promises.unlink(u.path).catch(() => undefined)),
        );
        res.status(400).json({ error: "One or more files failed file-type validation" });
        return;
      }
    }
  }

  // Save comment attachments
  if (uploadedFiles && uploadedFiles.length > 0) {
    await prisma.attachment.createMany({
      data: uploadedFiles.map((f) => ({
        id:        randomUUID(),
        filename:  sanitizeFilename(f.originalname), // H7 — prevent stored XSS via filename
        filepath:  f.path,
        mimetype:  f.mimetype,
        size:      f.size,
        commentId: comment.id,
      })),
    });
  }

  // Transform filepath → public URL
  const response = {
    ...comment,
    attachments: comment.attachments.map((a) => ({
      id:       a.id,
      filename: a.filename,
      mimetype: a.mimetype,
      size:     a.size,
      url:      "/uploads/" + path.basename(a.filepath),
    })),
  };
  res.status(201).json(response);
});

// ──────────────────────────────────────
// PATCH /api/portal/tickets/:id/rating
// ──────────────────────────────────────
router.patch("/tickets/:id/rating", requireCustomer, async (req: Request<{ id: string }>, res: Response) => {
  const parsed = portalRatingSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ fieldErrors: parsed.error.flatten().fieldErrors });
    return;
  }

  const ticket = await prisma.ticket.findUnique({
    where:  { ticketId: req.params.id },
    select: { id: true, status: true, rating: true, senderEmail: true },
  });

  if (!ticket) {
    res.status(404).json({ error: "Ticket not found" });
    return;
  }

  if (req.method !== "GET" && ticket.senderEmail !== req.user!.email) {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  if (ticket.status !== STATUS.CLOSED) {
    res.status(400).json({ error: "Ratings can only be submitted for closed tickets" });
    return;
  }

  if (ticket.rating !== null) {
    res.status(409).json({ error: "This ticket has already been rated" });
    return;
  }

  const updated = await prisma.ticket.update({
    where:  { ticketId: req.params.id },
    data:   { rating: parsed.data.rating, ratingText: parsed.data.ratingText ?? null },
    select: PORTAL_TICKET_SELECT,
  });

  res.json(updated);
});

// ──────────────────────────────────────
// GET /api/portal/captcha — public
// Returns a server-signed captcha challenge. Must be registered BEFORE /:slug
// routes to avoid routing conflicts.
// ──────────────────────────────────────
router.get("/captcha", captchaLimiter, (_req, res) => {
  const code = generateCaptchaCode();
  const ts   = Date.now().toString();
  const enc  = encryptCode(code, ts);
  const sig  = signCaptcha(ts, enc);
  const response: Record<string, string> = { token: `${ts}.${enc}.${sig}` };
  // Expose plaintext code only in test environment so E2E tests can submit valid answers
  if (process.env.NODE_ENV === "test") response.code = code;
  res.json(response);
});

function escXml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":'&#39;'})[c]!);
}

// GET /captcha-image — serves CAPTCHA challenge as SVG image (no plaintext code sent to client)
router.get("/captcha-image", captchaLimiter, (req, res) => {
  const token = (req.query["token"] as string) ?? "";
  const parts = token.split(".");
  if (parts.length !== 3) { res.status(400).send("Bad token"); return; }
  const [ts, encryptedCode, sig] = parts;
  if (Date.now() - parseInt(ts, 10) > 10 * 60 * 1000) { res.status(400).send("Expired"); return; }
  const expected = signCaptcha(ts, encryptedCode);
  let valid = false;
  try { valid = timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(expected, "hex")); } catch {}
  if (!valid) { res.status(400).send("Invalid token"); return; }
  let code: string;
  try { code = decryptCode(encryptedCode, ts); } catch { res.status(400).send("Decode error"); return; }

  // Generate SVG with per-request visual noise (randomBytes is cosmetic only)
  const seed = randomBytes(32);
  const COLORS = ["#e05a00", "#1a6bb5", "#2a8a3e", "#8b2be2", "#c0392b", "#16638a"];
  const letters = code.split("").map((ch, i) => {
    const x     = 20 + i * 26 + (seed[i] % 7) - 3;
    const y     = 28 + (seed[i + 5] % 9) - 4;
    const rot   = (seed[i + 10] % 30) - 15;
    const color = COLORS[i % COLORS.length];
    const size  = 20 + (seed[i + 20] % 6);
    return `<text x="${x}" y="${y}" transform="rotate(${rot},${x},${y})" font-family="'Courier New',monospace" font-size="${size}" font-weight="bold" fill="${color}">${escXml(ch)}</text>`;
  });
  const lines = Array.from({ length: 4 }, (_, i) => {
    const b = i * 8;
    return `<line x1="${seed[b] % 160}" y1="${seed[b + 1] % 48}" x2="${seed[b + 2] % 160}" y2="${seed[b + 3] % 48}" stroke="rgba(0,0,0,0.12)" stroke-width="1"/>`;
  });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="48" viewBox="0 0 160 48"><rect width="160" height="48" fill="#f5f5f0"/>${lines.join("")}${letters.join("")}</svg>`;

  res.setHeader("Content-Type", "image/svg+xml");
  res.setHeader("Cache-Control", "no-store");
  res.send(svg);
});

// ──────────────────────────────────────
// GET /api/portal/projects?clientId= — requires customer session
// Returns HRMS project list by HRMS client UUID (bypasses slug resolution)
// Must be registered BEFORE /:slug routes to avoid routing conflicts
// ──────────────────────────────────────
router.get("/projects", requireCustomer, async (req, res) => {
  const { clientId } = req.query as { clientId?: string };
  if (!clientId) {
    res.status(400).json({ error: "clientId query param required" });
    return;
  }
  const membership = await prisma.organizationMembership.findFirst({ where: { userId: req.user!.id, organization: { hrmsClientId: clientId, isActive: true } } });
  if (!membership) { res.status(403).json({ error: "Organization access required" }); return; }
  const projects = await getClientProjects(clientId);
  res.json(projects);
});

// ──────────────────────────────────────
// GET /api/portal/:slug/projects — public
// Returns HRMS project list for a client (used by portal submit form dropdown)
// ──────────────────────────────────────
router.get("/:slug/projects", projectsLimiter, async (req, res) => {
  const slug = req.params["slug"] as string;
  const client = await getClientBySlug(slug);
  if (!client) {
    res.status(404).json({ error: "Client not found" });
    return;
  }
  const projects = await getClientProjects(client.id);
  res.json(projects);
});

// ──────────────────────────────────────
// GET /api/portal/:slug — public, MUST be last
// Look up an HRMS client by slug
// ──────────────────────────────────────
router.get("/:slug", async (req, res) => {
  const { slug } = req.params;
  const client = await getClientBySlug(slug);
  if (!client) {
    res.status(404).json({ error: "Client not found" });
    return;
  }
  res.json(client);
});

// ──────────────────────────────────────
// POST /api/portal/:slug/tickets — public
// Submit a ticket from the customer portal (no auth required)
// ──────────────────────────────────────
router.post("/:slug/tickets", submitLimiter, async (req, res) => {
  // Run multer to parse multipart/form-data (files + text fields)
  try {
    await runUpload(req, res);
  } catch (err: unknown) {
    const isMulterError = err instanceof multer.MulterError;
    if (isMulterError && (err as multer.MulterError).code === "LIMIT_FILE_SIZE") {
      res.status(400).json({ error: "Each image must be under 1MB" });
      return;
    }
    if (isMulterError && (err as multer.MulterError).code === "LIMIT_FILE_COUNT") {
      res.status(400).json({ error: "Maximum 5 images allowed" });
      return;
    }
    res.status(400).json({ error: err instanceof Error ? err.message : "File upload error" });
    return;
  }

  // H-3 — magic byte validation: reject any file whose actual bytes do not
  // match a known image signature, even if the extension/MIME passed the gate.
  const uploadedFiles = req.files as Express.Multer.File[] | undefined;
  if (uploadedFiles && uploadedFiles.length > 0) {
    for (const f of uploadedFiles) {
      const valid = await validateMagicBytes(f.path);
      if (!valid) {
        // Delete all uploaded files for this request before rejecting
        await Promise.all(
          uploadedFiles.map((u) => fs.promises.unlink(u.path).catch(() => undefined)),
        );
        res.status(400).json({ error: "One or more files failed file-type validation" });
        return;
      }
    }
  }

  const isImplementation = req.body?.requestType === "implementation";

  const parsed = isImplementation
    ? implementationSubmitSchema.safeParse(req.body)
    : portalSubmitSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ fieldErrors: parsed.error.flatten().fieldErrors });
    return;
  }

  // M11 — Verify server-signed captcha token before accepting submission
  const { captchaToken, captchaAnswer } = parsed.data;
  if (!verifyCaptchaToken(captchaToken ?? "", captchaAnswer ?? "")) {
    res.status(400).json({ error: "Invalid or expired captcha. Please try again." });
    return;
  }

  const { name, email, subject, body, projectId, projectName } = parsed.data;
  const slug = req.params["slug"] as string;
  const implFields = isImplementation
    ? {
        businessGoal:    (parsed.data as any).businessGoal    as string,
        currentPain:     (parsed.data as any).currentPain     as string,
        expectedOutcome: (parsed.data as any).expectedOutcome as string,
        targetDate:      (parsed.data as any).targetDate      as string | undefined,
      }
    : null;

  const client = await getClientBySlug(slug);
  if (!client) {
    res.status(404).json({ error: "Client not found" });
    return;
  }

  const admin = await prisma.user.findFirst({ where: { role: ROLES.ADMIN } });

  if (!admin) {
    res.status(500).json({ error: "No admin user found to assign as ticket creator" });
    return;
  }

  let ticket: { id: string; ticketId: string };
  try {
    ticket = await prisma.$transaction(async (tx) => {
      const latest = await tx.ticket.findFirst({
        orderBy: { ticketId: "desc" },
        select:  { ticketId: true },
      });

      let nextNumber = 1;
      if (latest) {
        const match = latest.ticketId.match(/^TKT-(\d+)$/);
        if (match) nextNumber = parseInt(match[1], 10) + 1;
      }

      const ticketId    = `TKT-${String(nextNumber).padStart(4, "0")}`;
      // H9 — strip CR/LF from name and email to prevent CRLF injection in ticket description
      const safeName    = name.replace(/[\r\n]/g, " ");
      const safeEmail   = email.replace(/[\r\n]/g, "");
      const description = `From: ${safeName} <${safeEmail}>\n\n${body}`;

      const created = await tx.ticket.create({
        data: {
          id:            randomUUID(),
          ticketId,
          title:         subject,
          description,
          type:            isImplementation ? TICKET_TYPE.IMPLEMENTATION : TICKET_TYPE.SUPPORT,
          priority:        PRIORITY.MEDIUM,
          status:          isImplementation ? STATUS.SUBMITTED : STATUS.UN_ASSIGNED,
          project:         projectName ?? "General",
          senderName:      name,
          senderEmail:     email,
          hrmsClientId:    client.id,
          hrmsClientName:  client.customerName,
          hrmsProjectId:   projectId   ?? null,
          hrmsProjectName: projectName ?? null,
          createdById:     admin.id,
          assignedToId:    null,
        },
        select: { id: true, ticketId: true },
      });

      if (isImplementation && implFields) {
        await tx.implementationRequest.create({
          data: {
            id:              randomUUID(),
            ticketId:        created.id,
            businessGoal:    implFields.businessGoal,
            currentPain:     implFields.currentPain,
            expectedOutcome: implFields.expectedOutcome,
            targetDate:      implFields.targetDate ? new Date(implFields.targetDate) : null,
          },
        });
      }

      return created;
    });
  } catch (e) {
    console.error("[portal] Failed to create ticket:", e instanceof Error ? e.message : String(e));
    res.status(500).json({ error: "Failed to create ticket" });
    return;
  }

  // Save attachments (outside transaction — ticket is committed)
  if (uploadedFiles && uploadedFiles.length > 0) {
    try {
      await prisma.attachment.createMany({
        data: uploadedFiles.map((f) => ({
          id:       randomUUID(),
          filename: sanitizeFilename(f.originalname), // H7 — prevent stored XSS via filename
          filepath: f.path,
          mimetype: f.mimetype,
          size:     f.size,
          ticketId: ticket.id,
        })),
      });
    } catch (e) {
      console.error("[portal] Failed to save attachments:", e instanceof Error ? e.message : String(e));
      // Don't fail the request — ticket was created successfully
    }
  }

  if (isImplementation && implFields && admin.email) {
    void sendImplementationRequestSubmittedEmail({
      adminEmail:   admin.email,
      ticketId:     ticket.ticketId,
      customerName: name,
      title:        subject,
      businessGoal: implFields.businessGoal,
    }).catch((err) => console.error("[mailer] impl-submitted failed:", err));
  }

  res.status(201).json({ ticketId: ticket.ticketId, id: ticket.id });
});

// ─── Customer-side workflow actions on implementation tickets ────────────

router.post("/tickets/:id/approve-plan", requireCustomer, async (req: Request<{ id: string }>, res: Response) => {
  const ticket = await prisma.ticket.findUnique({
    where:  { ticketId: req.params.id },
    select: { id: true, ticketId: true, type: true, status: true, senderEmail: true, senderName: true, title: true },
  });
  if (!ticket) { res.status(404).json({ error: "Ticket not found" }); return; }

  const userEmail = (req as any).user?.email?.toLowerCase();
  if (
    ticket.senderEmail?.toLowerCase() !== userEmail ||
    ticket.type   !== TICKET_TYPE.IMPLEMENTATION ||
    ticket.status !== STATUS.CUSTOMER_APPROVAL
  ) {
    res.status(403).json({ error: "Not allowed" });
    return;
  }

  const updated = await prisma.$transaction(async (tx) => {
    const claimed = await tx.ticket.updateMany({ where: { id: ticket.id, status: STATUS.CUSTOMER_APPROVAL }, data: { status: STATUS.APPROVED } });
    if (claimed.count !== 1) throw new Error("Plan status changed; refresh this request");
    await tx.implementationRequest.update({
      where: { ticketId: ticket.id },
      data:  { customerApprovedAt: new Date(), customerRejectedAt: null, customerRejectionReason: null },
    });
    await tx.ticketHistory.create({ data: { ticketId: ticket.id, changedById: req.user!.id, field: "status", oldValue: ticket.status, newValue: STATUS.APPROVED } });
    return tx.ticket.update({
      where:  { id: ticket.id },
      data:   { status: STATUS.APPROVED },
      select: PORTAL_TICKET_SELECT,
    });
  });

  const admin = await prisma.user.findFirst({ where: { role: ROLES.ADMIN }, select: { email: true } });
  if (admin?.email) {
    void sendImplementationApprovedEmail({
      adminEmail:   admin.email,
      ticketId:     ticket.ticketId,
      customerName: ticket.senderName ?? "Customer",
      title:        ticket.title,
    }).catch((err) => console.error("[mailer] impl-approved failed:", err));
  }

  res.json(updated);
});

router.post("/tickets/:id/reject-plan", requireCustomer, async (req: Request<{ id: string }>, res: Response) => {
  const parsed = implementationRejectSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ fieldErrors: parsed.error.flatten().fieldErrors });
    return;
  }

  const ticket = await prisma.ticket.findUnique({
    where:  { ticketId: req.params.id },
    select: { id: true, ticketId: true, type: true, status: true, senderEmail: true, senderName: true, title: true },
  });
  if (!ticket) { res.status(404).json({ error: "Ticket not found" }); return; }

  const userEmail = (req as any).user?.email?.toLowerCase();
  if (
    ticket.senderEmail?.toLowerCase() !== userEmail ||
    ticket.type   !== TICKET_TYPE.IMPLEMENTATION ||
    ticket.status !== STATUS.CUSTOMER_APPROVAL
  ) {
    res.status(403).json({ error: "Not allowed" });
    return;
  }

  const updated = await prisma.$transaction(async (tx) => {
    const claimed = await tx.ticket.updateMany({ where: { id: ticket.id, status: STATUS.CUSTOMER_APPROVAL }, data: { status: STATUS.PLANNING } });
    if (claimed.count !== 1) throw new Error("Plan status changed; refresh this request");
    await tx.implementationRequest.update({
      where: { ticketId: ticket.id },
      data:  { customerRejectedAt: new Date(), customerRejectionReason: parsed.data.reason, customerApprovedAt: null },
    });
    await tx.ticketHistory.create({ data: { ticketId: ticket.id, changedById: req.user!.id, field: "status", oldValue: ticket.status, newValue: STATUS.PLANNING } });
    return tx.ticket.update({
      where:  { id: ticket.id },
      data:   { status: STATUS.PLANNING },
      select: PORTAL_TICKET_SELECT,
    });
  });

  const admin = await prisma.user.findFirst({ where: { role: ROLES.ADMIN }, select: { email: true } });
  if (admin?.email) {
    void sendImplementationRejectedEmail({
      adminEmail:   admin.email,
      ticketId:     ticket.ticketId,
      customerName: ticket.senderName ?? "Customer",
      title:        ticket.title,
      reason:       parsed.data.reason,
    }).catch((err) => console.error("[mailer] impl-rejected failed:", err));
  }

  res.json(updated);
});

// POST /api/portal/tickets/:id/reopen — customer reopens a closed ticket
router.post("/tickets/:id/reopen", requireCustomer, async (req: Request<{ id: string }>, res: Response) => {
  const email = req.user!.email;
  const id    = req.params.id as string;

  const ticket = await prisma.ticket.findUnique({
    where:  { ticketId: id },
    select: { id: true, senderEmail: true, status: true, title: true },
  });

  if (!ticket) {
    res.status(404).json({ error: "Ticket not found" });
    return;
  }
  if (ticket.senderEmail !== email) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  if (ticket.status !== "CLOSED" && ticket.status !== "OPEN_DONE") {
    res.status(400).json({ error: "Only closed or completed tickets can be reopened" });
    return;
  }

  await prisma.ticket.update({
    where: { ticketId: id },
    data:  { status: "REOPENED" },
  });

  // Notify admin (fire-and-forget)
  const baseUrl      = process.env.RIGHT_TRACKER_URL ?? process.env.BETTER_AUTH_URL ?? "";
  const customerName = req.user!.name ?? email;
  void sendTicketReopenedEmail(
    process.env.SUPPORT_EMAIL ?? "",
    id,
    ticket.title,
    customerName,
    `${baseUrl}/tickets/${id}`,
  ).catch(() => null);

  res.status(204).send();
});

export default router;
