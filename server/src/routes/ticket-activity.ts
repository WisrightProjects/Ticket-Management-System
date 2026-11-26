import { supportTicketScope } from "../lib/support-access.js";
import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { ROLES } from "@tms/core";
import prisma from "../lib/prisma.js";

const router = Router();
router.get("/:id/history", requireAuth, async (req, res) => {
  if (req.user!.role !== ROLES.ADMIN && req.user!.role !== ROLES.AGENT) { res.sendStatus(403); return; }
  const ticket = await prisma.ticket.findFirst({ where: { ticketId: String(req.params.id), ...supportTicketScope(req.user!.supportAccess) }, select: { id: true } });
  if (!ticket) { res.status(404).json({ error: "Ticket not found" }); return; }
  res.json(await prisma.ticketHistory.findMany({ where: { ticketId: ticket.id }, orderBy: { createdAt: "desc" }, take: 100, select: { id: true, field: true, oldValue: true, newValue: true, createdAt: true, changedBy: { select: { name: true } } } }));
});
export default router;
