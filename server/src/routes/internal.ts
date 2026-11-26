import { Router, type Request, type Response } from "express";
import { requireAuth } from "../middleware/auth.js";
import prisma from "../lib/prisma.js";
import { internalSubmitSchema, ROLES, STATUSES } from "@tms/core";
import { type Status } from "../generated/prisma/client.js";

import { getAllClients, getClientProjects } from "../lib/hrms.js";
import { assignedTicketScope, canManageTicketOperations, supportProjects, type SupportAccess } from "../lib/support-access.js";

const router = Router();

router.use(requireAuth);

// Block CUSTOMER-role sessions
router.use((req, res, next) => {
  const role = (req as any).user?.role;
  if (role !== ROLES.ADMIN && role !== ROLES.AGENT) {
    res.status(403).json({ error: "Access denied" });
    return;
  }
  next();
});

async function internalProjects(access?: SupportAccess) {
  const allowed = supportProjects(access);
  if (allowed && !allowed.length) return [];
  const clients = await getAllClients();
  const catalogue = (await Promise.all(clients.map(({ id }) => getClientProjects(id)))).flat();
  const projects = new Map(catalogue
    .filter(({ id }) => !allowed || allowed.includes(id))
    .map(({ id, projectName }) => [id, projectName]));
  const missing = allowed?.filter((id) => !projects.has(id)) ?? [];
  if (missing.length) {
    const known = await prisma.ticket.findMany({
      where: { hrmsProjectId: { in: missing }, hrmsProjectName: { not: null } },
      orderBy: { updatedAt: "desc" }, distinct: ["hrmsProjectId"],
      select: { hrmsProjectId: true, hrmsProjectName: true },
    });
    for (const { hrmsProjectId, hrmsProjectName } of known) {
      if (hrmsProjectId && hrmsProjectName) projects.set(hrmsProjectId, hrmsProjectName);
    }
    for (const id of missing) if (!projects.has(id)) projects.set(id, `WiseWork project (${id})`);
  }
  return Array.from(projects, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
}

router.get("/projects", async (req, res) => {
  res.json({ projects: await internalProjects(req.user!.supportAccess), projectRequired: !!supportProjects(req.user!.supportAccess) });
});

const INTERNAL_SELECT = {
  id:        true,
  ticketId:  true,
  title:     true,
  type:      true,
  priority:  true,
  status:    true,
  createdAt: true,
  updatedAt: true,
  assignedTo: { select: { id: true, name: true } },
} as const;

// POST /api/internal/tickets — submit a ticket on behalf of the logged-in agent
router.post("/tickets", async (req: Request, res: Response) => {
  if (req.user!.supportAccess && !canManageTicketOperations(req.user!)) { res.sendStatus(403); return; }
  const parsed = internalSubmitSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ fieldErrors: parsed.error.flatten().fieldErrors });
    return;
  }
  const { title, description, type, priority, projectId } = parsed.data;
  const user = req.user!;
  const allowed = supportProjects(user.supportAccess);
  if (allowed && (!projectId || !allowed.includes(projectId))) {
    res.status(403).json({ error: "Select a project you have access to." });
    return;
  }

  try {
    const project = projectId && (await internalProjects(user.supportAccess)).find(({ id }) => id === projectId);
    if (projectId && !project) {
      res.status(400).json({ error: "This project is unavailable." });
      return;
    }
    const ticket = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(726428)`;
      const [number] = await tx.$queryRaw<Array<{ next: number }>>`
        SELECT COALESCE(MAX(SUBSTRING("ticketId" FROM 5)::integer), 0) + 1 AS next
        FROM tickets WHERE "ticketId" ~ '^TKT-[0-9]+$'`;
      return tx.ticket.create({
        data: {
          ticketId: `TKT-${String(number.next).padStart(4, "0")}`,
          title, description, type, priority, status: "UN_ASSIGNED",
          project: project ? project.name : "Internal",
          hrmsProjectId: project ? project.id : null,
          hrmsProjectName: project ? project.name : null,
          senderName: user.name, senderEmail: user.email, createdById: user.id,
        },
        select: INTERNAL_SELECT,
      });
    });

    res.status(201).json(ticket);
  } catch {
    res.status(500).json({ error: "Failed to create ticket" });
  }
});

// GET /api/internal/tickets — list tickets directly assigned to the signed-in staff member
router.get("/tickets", async (req: Request, res: Response) => {
  const page     = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(50, Math.max(1, Number(req.query.pageSize) || 10));
  const statusRaw = typeof req.query.status === "string" && req.query.status ? req.query.status : undefined;
  const userId    = req.user!.id;

  if (statusRaw && !(STATUSES as readonly string[]).includes(statusRaw)) {
    res.status(400).json({ error: "Invalid status value" });
    return;
  }
  const status = statusRaw as Status | undefined;

  try {
    const where = {
      ...assignedTicketScope(userId, req.user!.supportAccess),
      ...(status ? { status } : {}),
    };

    const [tickets, total] = await Promise.all([
      prisma.ticket.findMany({
        where,
        select:  INTERNAL_SELECT,
        orderBy: { createdAt: "desc" },
        skip:    (page - 1) * pageSize,
        take:    pageSize,
      }),
      prisma.ticket.count({ where }),
    ]);

    res.json({ data: tickets, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
  } catch {
    res.status(500).json({ error: "Failed to fetch tickets" });
  }
});

// GET /api/internal/tickets/:id — get a single ticket (must be directly assigned to the signed-in staff member)
router.get("/tickets/:id", async (req: Request<{ id: string }>, res: Response) => {
  const { id } = req.params;
  const userId = req.user!.id;

  try {
    const ticket = await prisma.ticket.findFirst({
      where: { ticketId: id, ...assignedTicketScope(userId, req.user!.supportAccess) },
      select: {
        id:          true,
        ticketId:    true,
        title:       true,
        description: true,
        type:        true,
        priority:    true,
        status:      true,
        createdAt:   true,
        updatedAt:   true,
        assignedTo:  { select: { id: true, name: true } },
        attachments: { select: { id: true, filename: true, mimetype: true, size: true, createdAt: true } },
      },
    });

    if (!ticket) {
      res.status(404).json({ error: "Ticket not found" });
      return;
    }

    res.json(ticket);
  } catch {
    res.status(500).json({ error: "Failed to fetch ticket" });
  }
});

export default router;
