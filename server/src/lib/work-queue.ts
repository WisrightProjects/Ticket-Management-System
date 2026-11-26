import { RESOLVED_STATUSES, STATUS, type QueueQuery } from "@tms/core";
import type { Prisma } from "../generated/prisma/client.js";

export function queueScope(queue: QueueQuery["queue"], userId: string, teamIds: string[], now = new Date(), headedProjects: string[] = []): Prisma.TicketWhereInput {
  const active: Prisma.TicketWhereInput = { status: { notIn: RESOLVED_STATUSES } };
  switch (queue) {
    case "mine": return { ...active, assignedToId: userId };
    case "unassigned": return { ...active, assignedToId: null };
    case "triage": return { ...active, assignedToId: null, hrmsProjectId: { in: headedProjects } };
    case "teams": return { ...active, teamId: { in: teamIds } };
    case "waiting": return { status: { in: [STATUS.WAITING_FOR_CLIENT, STATUS.CUSTOMER_APPROVAL] } };
    case "overdue": return { ...active, dueAt: { lt: now } };
    case "recent": return { updatedAt: { gte: new Date(now.getTime() - 7 * 86400000) } };
    default: return active;
  }
}

export function queueFilters(query: QueueQuery): Prisma.TicketWhereInput {
  return {
    ...(query.search ? { OR: ["ticketId", "title", "senderName", "senderEmail"].map((field) => ({ [field]: { contains: query.search, mode: "insensitive" } })) } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.priority ? { priority: query.priority } : {}),
    ...(query.type ? { type: query.type } : {}),
    ...(query.organizationId ? { organizationId: query.organizationId } : {}),
    ...(query.teamId ? { teamId: query.teamId } : {}),
  };
}
