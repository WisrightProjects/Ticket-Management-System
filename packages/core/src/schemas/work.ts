import { z } from "zod";
import { PRIORITIES, STATUSES, TICKET_TYPES, type StatusValue } from "./ticket.js";
import { ROLES } from "./user.js";

export const QUEUE_KEYS = ["all", "mine", "unassigned", "triage", "teams", "waiting", "overdue", "recent"] as const;
export const QUEUE_LABELS: Record<(typeof QUEUE_KEYS)[number], string> = {
  all: "All active", mine: "Assigned to me", unassigned: "Unassigned", teams: "My teams",
  triage: "Project triage",
  waiting: "Waiting for customer", overdue: "Overdue", recent: "Recently updated",
};
export const queueQuerySchema = z.object({
  queue: z.enum(QUEUE_KEYS).default("mine"),
  search: z.string().trim().max(200).default(""),
  status: z.enum(STATUSES).optional(),
  priority: z.enum(PRIORITIES).optional(),
  type: z.enum(TICKET_TYPES).optional(),
  organizationId: z.string().max(150).optional(),
  teamId: z.string().uuid().optional(),
  sortBy: z.enum(["updatedAt", "createdAt", "dueAt", "ticketId", "title", "priority"]).default("updatedAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
});
export type QueueQuery = z.infer<typeof queueQuerySchema>;

export const bulkTicketSchema = z.object({
  ticketIds: z.array(z.string().regex(/^TKT-\d+$/)).min(1).max(50)
    .refine((ids) => new Set(ids).size === ids.length, "Duplicate ticket references are not allowed"),
  change: z.discriminatedUnion("field", [
    z.object({ field: z.literal("assignedToId"), value: z.string().uuid().nullable() }),
    z.object({ field: z.literal("teamId"), value: z.string().uuid().nullable() }),
    z.object({ field: z.literal("priority"), value: z.enum(PRIORITIES) }),
    z.object({ field: z.literal("status"), value: z.enum(STATUSES), resolutionSummary: z.string().trim().min(1).max(5000).optional() }),
    z.object({ field: z.literal("dueAt"), value: z.string().datetime({ offset: true }).nullable() }),
  ]),
});
export type TicketChange = z.infer<typeof bulkTicketSchema>["change"];
export const savedQueueSchema = z.object({ name: z.string().trim().min(1).max(80), filters: queueQuerySchema });
export const teamSchema = z.object({ name: z.string().trim().min(2).max(100), memberIds: z.array(z.string().uuid()).max(100).default([]) });
export const staffCommentSchema = z.object({
  content: z.string().trim().min(1).max(5000),
  isInternal: z.union([z.boolean(), z.enum(["true", "false"]).transform((value) => value === "true")]).default(false),
});

export type StaffActor = { id: string; role: string };
export type StaffWorkTicket = { assignedToId: string | null; teamId: string | null };

/** Reading the shared staff pool is separate from editing another person's work. */
export function canEditStaffTicket(actor: StaffActor, ticket: StaffWorkTicket): boolean {
  return actor.role === ROLES.ADMIN || (actor.role === ROLES.AGENT && ticket.assignedToId === actor.id);
}
export function canClaimStaffTicket(actor: StaffActor, ticket: StaffWorkTicket, teamIds: string[]): boolean {
  return actor.role === ROLES.ADMIN || (actor.role === ROLES.AGENT && ticket.assignedToId === null && (!ticket.teamId || teamIds.includes(ticket.teamId)));
}
export function canApplyTicketChange(actor: StaffActor, ticket: StaffWorkTicket, change: TicketChange, teamIds: string[]): boolean {
  if (actor.role === ROLES.ADMIN) return true;
  if (actor.role !== ROLES.AGENT || change.field === "teamId" || change.field === "dueAt") return false;
  if (change.field === "assignedToId") {
    return (change.value === actor.id && (canEditStaffTicket(actor, ticket) || canClaimStaffTicket(actor, ticket, teamIds)))
      || (change.value === null && canEditStaffTicket(actor, ticket));
  }
  return canEditStaffTicket(actor, ticket);
}
export const RESOLVED_STATUSES: StatusValue[] = ["OPEN_DONE", "CLOSED"];
