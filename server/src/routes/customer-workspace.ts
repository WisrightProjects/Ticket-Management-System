import { Router } from "express";
import { randomUUID } from "node:crypto";
import { z } from "@tms/core";
import { STATUS, STATUSES, implementationSubmitSchema, portalSubmitSchema } from "@tms/core";
import prisma from "../lib/prisma.js";
import { requireCustomer } from "../middleware/customerAuth.js";
import { customerTicketScope } from "../lib/customer-access.js";
import { runImageUpload } from "../lib/upload.js";
import fs from "node:fs/promises";
import path from "node:path";
import { getClientProjects, getEmployeeDirectory } from "../lib/hrms.js";
import { sendNewTicketNotificationEmail } from "../lib/mailer.js";

const router = Router();
router.get("/organizations/:id/projects", requireCustomer, async (req, res) => {
  const id = String(req.params.id);
  if (!req.customerMemberships?.some((membership) => membership.organizationId === id)) {
    res.sendStatus(403);
    return;
  }
  const organization = await prisma.organization.findUnique({ where: { id } });
  const projects = organization?.hrmsClientId ? await getClientProjects(organization.hrmsClientId) : [];
  res.json(projects.map(({ id, projectName }) => ({ id, projectName })));
});
router.get("/me", requireCustomer, async (req, res) => {
  const memberships = await prisma.organizationMembership.findMany({ where: { userId: req.user!.id, organization: { isActive: true } }, select: { role: true, organization: { select: { id: true, name: true, slug: true } } } });
  res.json({ id: req.user!.id, name: req.user!.name, email: req.user!.email, memberships });
});
router.patch("/me", requireCustomer, async (req, res) => {
  const parsed = z.object({ name: z.string().trim().min(1).max(128) }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "A display name is required" }); return; }
  res.json(await prisma.user.update({ where: { id: req.user!.id }, data: parsed.data, select: { name: true, email: true } }));
});
router.get("/dashboard", requireCustomer, async (req, res) => {
  const where = customerTicketScope(req);
  const [total, grouped, recent] = await Promise.all([
    prisma.ticket.count({ where }), prisma.ticket.groupBy({ by: ["status"], where, _count: { _all: true } }),
    prisma.ticket.findMany({ where, orderBy: { updatedAt: "desc" }, take: 10, select: { ticketId: true, title: true, status: true, priority: true, updatedAt: true, createdAt: true, type: true, organization: { select: { name: true } } } }),
  ]);
  const counts = Object.fromEntries(grouped.map((g) => [g.status, g._count._all]));
  res.json({ total, active: total - (counts.CLOSED ?? 0) - (counts.OPEN_DONE ?? 0),
    waiting: (counts.WAITING_FOR_CLIENT ?? 0) + (counts.CUSTOMER_APPROVAL ?? 0), resolved: (counts.OPEN_DONE ?? 0) + (counts.CLOSED ?? 0), recent, counts });
});

router.post("/requests", requireCustomer, async (req, res) => {
  let files: Express.Multer.File[] = [];
  let committed = false;
  try {
    await runImageUpload(req, res);
    files = (req.files as Express.Multer.File[] | undefined) ?? [];
    const submissionKey = z.string().uuid().optional().safeParse(req.body.submissionKey);
    if (!submissionKey.success) { res.status(400).json({ error: "Invalid submission key" }); return; }
    const membership = req.customerMemberships?.find((m) => m.organizationId === req.body.organizationId);
    if (!membership) { res.status(403).json({ error: "Select an organization you belong to" }); return; }
    const isImplementation = req.body.requestType === "implementation";
    const identity = { ...req.body, name: req.user!.name, email: req.user!.email };
    const parsed = isImplementation ? implementationSubmitSchema.safeParse(identity) : portalSubmitSchema.safeParse(identity);
    if (!parsed.success) { res.status(400).json({ error: "Please complete all required request details", fieldErrors: parsed.error.flatten().fieldErrors }); return; }
    const category = z.enum(["BUG", "SUPPORT", "REQUIREMENT", "EXPLANATION"]).safeParse(req.body.category ?? "SUPPORT");
    if (!category.success) { res.status(400).json({ error: "Invalid request category" }); return; }
    const data = parsed.data;
    const organization = await prisma.organization.findUniqueOrThrow({ where: { id: membership.organizationId } });
    const projectId = z.string().regex(/^[\w-]{1,128}$/).optional().safeParse(req.body.projectId);
    if (!projectId.success) { res.status(400).json({ error: "Select a valid project." }); return; }
    const projects = projectId.data && organization.hrmsClientId ? await getClientProjects(organization.hrmsClientId) : [];
    const project = projects.find((item) => item.id === projectId.data);
    if (projectId.data && !project) { res.status(400).json({ error: "This project is unavailable for your organization." }); return; }
    const impl = implementationSubmitSchema.safeParse(identity);
    const ticket = await prisma.$transaction(async (tx) => {
      // All new request creation in this path serializes ticket-number allocation.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(726428)`;
      if (submissionKey.data) {
        const existing = await tx.ticket.findUnique({ where: { submissionKey: submissionKey.data } });
        if (existing) {
          if (existing.requesterId !== req.user!.id || existing.organizationId !== membership.organizationId) throw new Error("Invalid request key");
          return { ticketId: existing.ticketId, reused: true };
        }
      }
      const rows = await tx.$queryRaw<Array<{ next: number }>>`SELECT COALESCE(MAX(SUBSTRING("ticketId" FROM 5)::integer), 0) + 1 AS next FROM tickets WHERE "ticketId" ~ '^TKT-[0-9]+$'`;
      return tx.ticket.create({ data: {
        id: randomUUID(), submissionKey: submissionKey.data, ticketId: `TKT-${String(rows[0]!.next).padStart(4, "0")}`, title: data.subject.trim(), description: data.body.trim(),
        type: isImplementation ? "IMPLEMENTATION" : category.data, priority: "MEDIUM", status: isImplementation ? STATUS.SUBMITTED : STATUS.UN_ASSIGNED,
        project: project?.projectName ?? "General", hrmsProjectId: project?.id, hrmsProjectName: project?.projectName,
        organizationId: organization.id, hrmsClientId: organization.hrmsClientId,
        hrmsClientName: organization.name, senderName: req.user!.name, senderEmail: req.user!.email,
        requesterId: req.user!.id, createdById: req.user!.id,
        ...(isImplementation && impl.success ? { implementationRequest: { create: { businessGoal: impl.data.businessGoal, currentPain: impl.data.currentPain, expectedOutcome: impl.data.expectedOutcome, targetDate: impl.data.targetDate ? new Date(impl.data.targetDate) : null } } } : {}),
        attachments: { create: files.map((f) => ({ filename: f.originalname.replace(/[<>"'&/\\]/g, "_").slice(0, 255), filepath: f.path, mimetype: f.mimetype, size: f.size })) },
      }, select: { ticketId: true } });
    });
    committed = !("reused" in ticket);
    res.status(201).json(ticket);
    if (committed && project?.headEmployeeId) {
      void getEmployeeDirectory().then((employees) => {
        const head = employees.find((employee) => employee.id === project.headEmployeeId);
        if (head) return sendNewTicketNotificationEmail({
          adminEmail: head.email, ticketId: ticket.ticketId, customerName: req.user!.name,
          title: data.subject, source: project.projectName,
        });
      }).catch((error) => console.warn("[project-triage] Unable to notify project head:", error));
    }
  } catch { res.status(400).json({ error: "Unable to submit request. Check the fields and image limits (5 images, 1 MB each)." }); }
  finally { if (!committed) await Promise.all(files.map((f) => fs.unlink(f.path).catch(() => undefined))); }
});

// Guard every legacy ticket action with the same organization/requester predicate.
router.use("/tickets/:id", requireCustomer, async (req, res, next) => {
  const ticket = await prisma.ticket.findFirst({ where: { AND: [customerTicketScope(req), { ticketId: String(req.params.id) }] } });
  if (!ticket) { res.status(404).json({ error: "Request not found" }); return; }
  if (req.method !== "GET" && ticket.requesterId !== req.user!.id) { res.status(403).json({ error: "Only the requester can perform this action" }); return; }
  next();
});
router.get("/tickets", requireCustomer, async (req, res) => {
  const query = z.object({ page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(10), search: z.string().max(200).optional(), status: z.enum(STATUSES).optional(), view: z.enum(["active", "waiting", "resolved"]).optional() }).safeParse(req.query);
  if (!query.success) { res.status(400).json({ error: "Invalid filters" }); return; }
  const { page, pageSize, search, status, view } = query.data;
  const viewFilter = view === "waiting" ? { status: { in: [STATUS.WAITING_FOR_CLIENT, STATUS.CUSTOMER_APPROVAL] } }
    : view === "resolved" ? { status: { in: [STATUS.OPEN_DONE, STATUS.CLOSED] } }
    : view === "active" ? { status: { notIn: [STATUS.OPEN_DONE, STATUS.CLOSED] } } : {};
  const where = { AND: [customerTicketScope(req), viewFilter, ...(status ? [{ status }] : []), ...(search ? [{ OR: [{ title: { contains: search, mode: "insensitive" as const } }, { ticketId: { contains: search, mode: "insensitive" as const } }] }] : [])] };
  const [data, total] = await Promise.all([prisma.ticket.findMany({ where, orderBy: { updatedAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize, select: {
    id: true, ticketId: true, title: true, description: true, type: true, priority: true, status: true, project: true,
    createdAt: true, updatedAt: true, organization: { select: { name: true } }, attachments: { where: { OR: [{ commentId: null }, { comment: { isInternal: false } }] }, select: { id: true, filename: true, filepath: true } },
  } }), prisma.ticket.count({ where })]);
  res.json({ data: data.map((t) => ({ ...t, attachments: t.attachments.map((a) => ({ id: a.id, filename: a.filename, url: `/uploads/${path.basename(a.filepath)}` })) })), total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
});

export default router;
