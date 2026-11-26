import { STATUS, statusUpdateOptions, type StatusValue, type TicketTypeValue } from "@tms/core";
import prisma from "./prisma.js";

export function canTransition(current: StatusValue, next: StatusValue, type: TicketTypeValue): boolean {
  return statusUpdateOptions(current, type).includes(next);
}

export async function changeTicketStatus(ticketId: string, next: StatusValue, actorId: string, resolutionSummary?: string) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${ticketId}))`;
    const ticket = await tx.ticket.findUniqueOrThrow({ where: { id: ticketId } });
    if (!canTransition(ticket.status, next, ticket.type)) throw new Error("Status changed. Refresh the ticket and try again.");
    const result = await tx.ticket.update({ where: { id: ticketId }, data: {
      status: next,
      ...(resolutionSummary ? { resolutionSummary } : {}),
      ...(next === STATUS.OPEN_DONE && !ticket.resolvedAt ? { resolvedAt: new Date() } : {}),
      ...(next === STATUS.CLOSED ? { closedAt: new Date() } : {}),
    } });
    if (ticket.status !== next) await tx.ticketHistory.create({ data: {
      ticketId, changedById: actorId, field: "status", oldValue: ticket.status, newValue: next,
    } });
    return result;
  });
}
