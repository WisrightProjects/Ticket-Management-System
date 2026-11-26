import { Router } from "express";
import { randomBytes, randomUUID, createHash } from "node:crypto";
import { z, ROLES } from "@tms/core";
import { requireAuth } from "../middleware/auth.js";
import prisma from "../lib/prisma.js";
import { sendInvitationEmail } from "../lib/mailer.js";
import { getAllClients, slugifyName } from "../lib/hrms.js";
import { Prisma } from "../generated/prisma/client.js";

const router = Router();
router.use(requireAuth);
router.use((req, res, next) => {
  const user = req.user!;
  const canManageClients = user.supportAccess
    ? user.supportAccess.support_role === "TSA"
    : user.role === ROLES.ADMIN;
  if (!canManageClients) { res.status(403).json({ error: "Client management access required." }); return; }
  next();
});
const organizationSchema = z.object({ name: z.string().trim().min(2).max(150), slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(100) });
const inviteSchema = z.object({ email: z.string().trim().toLowerCase().email(), role: z.enum(["MEMBER", "MANAGER"]).default("MEMBER") });

router.get("/wisework-clients", async (_req, res) => {
  res.json(await getAllClients());
});

router.post("/client-setup", async (req, res) => {
  const parsed = z.object({ clientId: z.string().min(1).max(128) }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Select a WiseWork company." }); return; }
  const { clientId } = parsed.data;
  const existing = await prisma.organization.findUnique({ where: { hrmsClientId: clientId }, select: { id: true } });
  if (existing) { res.json(existing); return; }
  const client = (await getAllClients()).find((item) => item.id === clientId);
  if (!client) { res.status(400).json({ error: "This company is unavailable in the WiseWork directory." }); return; }
  const name = client.customerName.trim().slice(0, 150);
  const review = await prisma.organization.findFirst({
    where: { hrmsClientId: null, name: { equals: name, mode: "insensitive" } },
    select: { id: true },
  });
  if (review) {
    res.status(409).json({ error: "A workspace with this company name already exists. Review its WiseWork connection before creating another.", organizationId: review.id });
    return;
  }
  const id = randomUUID();
  const slug = `${slugifyName(name).slice(0, 60).replace(/-$/, "") || "client"}-${id}`;
  try {
    res.status(201).json(await prisma.organization.create({ data: { id, name, slug, hrmsClientId: clientId }, select: { id: true } }));
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const linked = await prisma.organization.findUnique({ where: { hrmsClientId: clientId }, select: { id: true } });
      if (linked) { res.json(linked); return; }
    }
    throw error;
  }
});

router.patch("/:id/wisework-client", async (req, res) => {
  const parsed = z.object({ clientId: z.string().min(1).max(128).nullable() }).safeParse(req.body);
  const clientId = parsed.success ? parsed.data.clientId : null;
  const client = clientId ? (await getAllClients()).find((item) => item.id === clientId) : undefined;
  if (!parsed.success || (clientId && !client)) {
    res.status(400).json({ error: "Select an active WiseWork client." });
    return;
  }
  const id = String(req.params.id);
  try {
    await prisma.$transaction(async (tx) => {
      const organization = await tx.organization.update({ where: { id }, data: { hrmsClientId: clientId }, select: { name: true } });
      if (client && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(organization.name)) {
        await tx.organization.updateMany({
          where: { id, name: organization.name },
          data: { name: client.customerName },
        });
      }
    });
    res.sendStatus(204);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const linked = clientId ? await prisma.organization.findUnique({ where: { hrmsClientId: clientId }, select: { name: true } }) : null;
      res.status(409).json({ error: linked ? `This WiseWork client is already linked to ${linked.name}. Open that organization to manage it.` : "This WiseWork client is already linked to another organization." });
      return;
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      res.status(404).json({ error: "Organization not found." });
      return;
    }
    throw error;
  }
});

router.get("/", async (_req, res) => {
  const organizations = await prisma.organization.findMany({ orderBy: { name: "asc" }, include: {
    _count: { select: { memberships: true, tickets: true } },
    memberships: { select: { id: true, role: true, user: { select: { id: true, name: true, email: true, isActive: true } } } },
    invitations: { select: { id: true, email: true, role: true, expiresAt: true, acceptedAt: true, revokedAt: true }, orderBy: { createdAt: "desc" } },
  } });
  res.json(organizations);
});

router.post("/", async (req, res) => {
  const parsed = organizationSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Enter a name and a URL-safe slug" }); return; }
  try { res.status(201).json(await prisma.organization.create({ data: { id: randomUUID(), ...parsed.data } })); }
  catch { res.status(409).json({ error: "Organization slug already exists" }); }
});

router.post("/:id/invitations", async (req, res) => {
  const parsed = inviteSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "A valid email and membership role are required" }); return; }
  const organizationId = String(req.params.id);
  const organization = await prisma.organization.findFirst({ where: { id: organizationId, isActive: true } });
  if (!organization) { res.status(404).json({ error: "Organization not found" }); return; }
  const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (existing) { res.status(409).json({ error: "This email already has an account. Existing-account membership changes require an administrator review." }); return; }
  const token = randomBytes(32).toString("hex");
  const invitation = await prisma.$transaction(async (tx) => {
    await tx.customerInvitation.updateMany({ where: { organizationId, email: parsed.data.email, acceptedAt: null, revokedAt: null }, data: { revokedAt: new Date() } });
    return tx.customerInvitation.create({ data: { id: randomUUID(), organizationId, ...parsed.data,
      tokenHash: createHash("sha256").update(token).digest("hex"), expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
    } });
  });
  const activationUrl = `${process.env.CLIENT_URL ?? "http://localhost:5173"}/activate?token=${token}`;
  let delivery = "sent";
  try { await sendInvitationEmail(parsed.data.email, organization.name, activationUrl); }
  catch { delivery = "failed"; }
  res.status(201).json({ id: invitation.id, email: invitation.email, expiresAt: invitation.expiresAt, delivery,
    // Admin-only manual delivery supports local development without contacting real SMTP.
    activationUrl,
  });
});

router.delete("/:id/invitations/:invitationId", async (req, res) => {
  const result = await prisma.customerInvitation.updateMany({ where: { id: String(req.params.invitationId), organizationId: String(req.params.id), acceptedAt: null, revokedAt: null }, data: { revokedAt: new Date() } });
  if (!result.count) { res.status(404).json({ error: "Pending invitation not found" }); return; }
  res.status(204).end();
});

router.get("/migration-review", async (req, res) => {
  if (req.user?.role !== ROLES.ADMIN || req.user.supportAccess) {
    res.status(403).json({ error: "Admin access required." }); return;
  }
  res.json({ unmappedTickets: await prisma.ticket.count({ where: { OR: [{ organizationId: null }, { requesterId: null }] } }),
    unlinkedCustomers: await prisma.user.count({ where: { role: ROLES.CUSTOMER, memberships: { none: {} } } }) });
});
export default router;
