import { supportProjects, supportTicketScope } from "../lib/support-access.js";
import { Router } from "express";
import { ROLES, QUEUE_KEYS, queueQuerySchema, bulkTicketSchema, savedQueueSchema, teamSchema, z } from "@tms/core";
import { requireAuth } from "../middleware/auth.js";
import prisma from "../lib/prisma.js";
import { applyStaffTicketChange, WorkError } from "../lib/staff-ticket-service.js";
import { queueFilters, queueScope } from "../lib/work-queue.js";
import { pushSyncToWisework } from "./tickets.js";
import { getStaffHeadedProjects } from "../lib/hrms.js";

const router = Router();
router.use(requireAuth);
router.use((req, res, next) => {
  if (req.user?.role !== ROLES.ADMIN && req.user?.role !== ROLES.AGENT) { res.status(403).json({ error: "Staff access required" }); return; }
  next();
});

router.get("/queue", async (req, res) => {
  const parsed = queueQuerySchema.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: "Invalid queue filters" }); return; }
  const query = parsed.data;
  const memberships = await prisma.teamMember.findMany({ where: { userId: req.user!.id }, select: { teamId: true } });
  const teamIds = memberships.map((m) => m.teamId);
  const headedProjects = req.user!.supportAccess?.led_project_ids ?? await getStaffHeadedProjects(req.user!.email);
  const base = queueFilters(query);
  const now = new Date();
  const where = { AND: [base, supportTicketScope(req.user!.supportAccess), queueScope(query.queue, req.user!.id, teamIds, now, headedProjects)] };
  const orderBy = query.sortBy === "dueAt" ? { dueAt: { sort: query.sortOrder, nulls: "last" as const } } : { [query.sortBy]: query.sortOrder };
  const [data, total, counts] = await Promise.all([
    prisma.ticket.findMany({ where, orderBy: [orderBy, { id: "asc" }], skip: (query.page - 1) * query.pageSize, take: query.pageSize, select: {
      ticketId: true, title: true, status: true, priority: true, type: true, senderName: true, senderEmail: true,
      assignedToId: true, teamId: true, hrmsProjectId: true, hrmsClientName: true, dueAt: true, updatedAt: true, createdAt: true,
      assignedTo: { select: { name: true } }, organization: { select: { id: true, name: true } },
      team: { select: { id: true, name: true } }, createdBy: { select: { name: true } },
    } }), prisma.ticket.count({ where }),
    Promise.all(QUEUE_KEYS.map(async (queue) => [queue, await prisma.ticket.count({ where: { AND: [base, supportTicketScope(req.user!.supportAccess), queueScope(queue, req.user!.id, teamIds, now, headedProjects)] } })] as const)),
  ]);
  res.json({ data, total, asOf: now.toISOString(), page: query.page, pageSize: query.pageSize, totalPages: Math.ceil(total / query.pageSize), counts: Object.fromEntries(counts) });
});

router.get("/options", async (req, res) => {
  if (supportProjects(req.user!.supportAccess)) {
    res.json({ staff: [], teams: [], organizations: [], myTeamIds: [], headedProjects: req.user!.supportAccess!.led_project_ids });
    return;
  }
  const [staff, teams, organizations] = await Promise.all([
    prisma.user.findMany({ where: { isActive: true, role: { in: [ROLES.ADMIN, ROLES.AGENT] } }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.team.findMany({ select: { id: true, name: true, members: { select: { userId: true, user: { select: { name: true, isActive: true } } } } }, orderBy: { name: "asc" } }),
    prisma.organization.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  res.json({ staff, teams, organizations, myTeamIds: teams.filter((t) => t.members.some((m) => m.userId === req.user!.id)).map((t) => t.id),
    headedProjects: await getStaffHeadedProjects(req.user!.email) });
});

router.post("/bulk", async (req, res) => {
  const parsed = bulkTicketSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Select up to 50 unique tickets and a valid change." }); return; }
  try {
    const result = await applyStaffTicketChange(parsed.data.ticketIds, req.user!, parsed.data.change);
    res.json(result);
    for (const ticketId of result.ticketIds) void pushSyncToWisework(ticketId, req.user!.name, parsed.data.change.field === "assignedToId");
  } catch (error) {
    if (error instanceof WorkError) { res.status(error.status).json({ error: error.message }); return; }
    throw error;
  }
});

router.get("/views", async (req, res) => {
  res.json(await prisma.queueView.findMany({ where: { userId: req.user!.id }, select: { id: true, name: true, filters: true }, orderBy: { name: "asc" } }));
});
router.post("/views", async (req, res) => {
  const parsed = savedQueueSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Enter a view name and valid filters." }); return; }
  if (await prisma.queueView.count({ where: { userId: req.user!.id } }) >= 20) { res.status(400).json({ error: "You can save up to 20 personal views." }); return; }
  try { res.status(201).json(await prisma.queueView.create({ data: { userId: req.user!.id, name: parsed.data.name, filters: { ...parsed.data.filters, page: 1 } }, select: { id: true, name: true, filters: true } })); }
  catch { res.status(409).json({ error: "A view with this name already exists." }); }
});
router.delete("/views/:id", async (req, res) => {
  const result = await prisma.queueView.deleteMany({ where: { id: String(req.params.id), userId: req.user!.id } });
  if (!result.count) { res.status(404).json({ error: "Saved view not found." }); return; }
  res.status(204).end();
});

router.post("/teams", async (req, res) => {
  if (req.user!.role !== ROLES.ADMIN || req.user!.supportAccess) { res.status(403).json({ error: "Admin access required" }); return; }
  const parsed = teamSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Enter a team name and valid staff members." }); return; }
  const memberIds = [...new Set(parsed.data.memberIds)];
  const count = await prisma.user.count({ where: { id: { in: memberIds }, isActive: true, role: { in: [ROLES.ADMIN, ROLES.AGENT] } } });
  if (count !== memberIds.length) { res.status(400).json({ error: "Team members must be active staff." }); return; }
  try { res.status(201).json(await prisma.team.create({ data: { name: parsed.data.name, members: { create: memberIds.map((userId) => ({ userId })) } }, select: { id: true, name: true } })); }
  catch { res.status(409).json({ error: "A team with this name already exists." }); }
});
router.put("/teams/:id/members", async (req, res) => {
  if (req.user!.role !== ROLES.ADMIN || req.user!.supportAccess) { res.status(403).json({ error: "Admin access required" }); return; }
  const parsed = z.object({ memberIds: z.array(z.string().uuid()).max(100) }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid staff members." }); return; }
  const teamId = String(req.params.id);
  const memberIds = [...new Set(parsed.data.memberIds)];
  try {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`team:${teamId}`}))`;
      if (!await tx.team.findUnique({ where: { id: teamId } })) throw new WorkError(404, "Team not found.");
      const count = await tx.user.count({ where: { id: { in: memberIds }, isActive: true, role: { in: [ROLES.ADMIN, ROLES.AGENT] } } });
      if (count !== memberIds.length) throw new WorkError(400, "Team members must be active staff.");
      const assigned = await tx.ticket.count({ where: { teamId, assignedToId: { not: null, notIn: memberIds } } });
      if (assigned) throw new WorkError(409, "Reassign tickets before removing their assignees from this team.");
      await tx.teamMember.deleteMany({ where: { teamId } });
      if (memberIds.length) await tx.teamMember.createMany({ data: memberIds.map((userId) => ({ teamId, userId })), skipDuplicates: true });
    });
    res.json({ success: true });
  } catch (error) { if (error instanceof WorkError) { res.status(error.status).json({ error: error.message }); return; } throw error; }
});
export default router;
