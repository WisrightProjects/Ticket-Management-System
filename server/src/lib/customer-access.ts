import type { Request } from "express";
import type { Prisma } from "../generated/prisma/client.js";

export function customerTicketScope(req: Request): Prisma.TicketWhereInput {
  const memberships = req.customerMemberships ?? [];
  return { OR: memberships.map((m) => ({
    organizationId: m.organizationId,
    ...(m.role === "MANAGER" ? {} : { requesterId: req.user!.id }),
  })) };
}

export function customerOwnTicketScope(req: Request): Prisma.TicketWhereInput {
  return { AND: [customerTicketScope(req), { requesterId: req.user!.id }] };
}
