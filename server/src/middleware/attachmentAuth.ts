import { supportProjects, supportTicketScope } from "../lib/support-access.js";
import type { Request, Response, NextFunction } from "express";
import path from "node:path";
import prisma from "../lib/prisma.js";
import { requireAuth } from "./auth.js";
import { ROLES } from "@tms/core";

export async function authorizeAttachment(req: Request, res: Response, next: NextFunction) {
  await requireAuth(req, res, () => undefined);
  if (!req.user) return;
  const filename = path.basename(req.path);
  res.setHeader("Cache-Control", "private, no-store");
  if (supportProjects(req.user.supportAccess)) {
    const scope = supportTicketScope(req.user.supportAccess);
    const attachment = await prisma.attachment.findFirst({ where: { AND: [
      { OR: [{ filepath: { endsWith: `/${filename}` } }, { filepath: { endsWith: `\\${filename}` } }] },
      { OR: [{ ticket: scope }, { comment: { ticket: scope } }] },
    ] }, select: { id: true } });
    if (!attachment) { res.sendStatus(404); return; }
    next(); return;
  }
  if (req.user.role === ROLES.ADMIN || req.user.role === ROLES.AGENT) { next(); return; }
  if (req.user.role !== ROLES.CUSTOMER) { res.sendStatus(403); return; }
  const memberships = await prisma.organizationMembership.findMany({ where: { userId: req.user.id, organization: { isActive: true } } });
  const scope = { OR: memberships.map((m) => ({ organizationId: m.organizationId, ...(m.role === "MANAGER" ? {} : { requesterId: req.user!.id }) })) };
  const attachment = await prisma.attachment.findFirst({ where: { AND: [
    { OR: [{ filepath: { endsWith: `/${filename}` } }, { filepath: { endsWith: `\\${filename}` } }] },
    { OR: [{ ticket: scope }, { comment: { isInternal: false, ticket: scope } }] },
    { OR: [{ commentId: null }, { comment: { isInternal: false } }] },
  ] }, select: { id: true } });
  if (!attachment) { res.sendStatus(404); return; }
  next();
}
