import { canManageTicketOperations, permitsSupportAction, type SupportActor } from "./support-access.js";
import { ROLES, STATUS, TICKET_TYPE, canApplyTicketChange, canEditStaffTicket, statusUpdateOptions, type StaffActor, type TicketChange } from "@tms/core";
import prisma from "./prisma.js";
import type { Prisma } from "../generated/prisma/client.js";
import { getProjectEmployees, getStaffHeadedProjects } from "./hrms.js";

export class WorkError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

/** Validate every target before writing, with locks shared by single and bulk edits. */
export async function applyStaffTicketChange(references: string[], actor: StaffActor & SupportActor, change: TicketChange) {
  if (actor.supportAccess && !canManageTicketOperations(actor) && (change.field !== "assignedToId" || actor.supportAccess.support_role === "MEMBER")) {
    throw new WorkError(403, "Your WiseWork support role cannot make this change.");
  }
  const projectMembers = new Map<string, Set<string>>();
  let headedProjects: string[] = [];
  if (change.field === "assignedToId") {
    const projects = await prisma.ticket.findMany({ where: { ticketId: { in: references }, hrmsProjectId: { not: null } }, distinct: ["hrmsProjectId"], select: { hrmsProjectId: true } });
    const actorAccount = !actor.supportAccess && projects.length && actor.role === ROLES.AGENT
      ? await prisma.user.findUnique({ where: { id: actor.id, isActive: true }, select: { email: true } }) : null;
    await Promise.all([
      ...projects.map(async ({ hrmsProjectId }) => {
        if (!change.value || !hrmsProjectId) return;
        const members = await getProjectEmployees(hrmsProjectId);
        projectMembers.set(hrmsProjectId, new Set(members.map((member) => member.email.toLowerCase())));
      }),
      ...(actorAccount ? [getStaffHeadedProjects(actorAccount.email).then((ids) => { headedProjects = ids; })] : []),
    ]);
  }
  return prisma.$transaction(async (tx) => {
    const initial = await tx.ticket.findMany({ where: { ticketId: { in: references } }, select: { id: true } });
    if (initial.length !== references.length) throw new WorkError(404, "One or more tickets no longer exist. Refresh the queue.");
    for (const id of initial.map((t) => t.id).sort()) await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${id}))`;
    const tickets = await tx.ticket.findMany({ where: { id: { in: initial.map((t) => t.id) } }, include: { assignedTo: { select: { name: true } }, team: { select: { name: true } } } });
    const affectedTeams = [...new Set([...tickets.map((t) => t.teamId), change.field === "teamId" ? change.value : null].filter((id): id is string => !!id))].sort();
    for (const teamId of affectedTeams) await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`team:${teamId}`}))`;
    const memberships = await tx.teamMember.findMany({ where: { userId: actor.id }, select: { teamId: true } });
    const teamIds = memberships.map((m) => m.teamId);
    let assigneeName: string | null = null;
    let teamName: string | null = null;
    if (change.field === "assignedToId" && change.value) {
      const user = await tx.user.findFirst({ where: { id: change.value, isActive: true, role: { in: [ROLES.ADMIN, ROLES.AGENT] } }, select: { name: true, email: true } });
      if (!user) throw new WorkError(400, "Choose an active staff account.");
      assigneeName = user.name;
      if (tickets.some((ticket) => ticket.hrmsProjectId && !projectMembers.get(ticket.hrmsProjectId)?.has(user.email.toLowerCase()))) {
        throw new WorkError(400, "Choose an active member of each ticket’s WiseWork project.");
      }
      const targetTeams = await tx.teamMember.findMany({ where: { userId: change.value }, select: { teamId: true } });
      if (tickets.some((t) => t.teamId && !targetTeams.some((m) => m.teamId === t.teamId))) throw new WorkError(400, "The assignee must belong to each ticket’s team.");
    }
    if (change.field === "teamId" && change.value) {
      const team = await tx.team.findUnique({ where: { id: change.value }, include: { members: { select: { userId: true } } } });
      if (!team) throw new WorkError(400, "Team not found.");
      teamName = team.name;
      if (tickets.some((t) => t.assignedToId && !team.members.some((m) => m.userId === t.assignedToId))) throw new WorkError(400, "Unassign tickets whose assignees do not belong to the new team first.");
    }
    for (const ticket of tickets) {
      const projectAssignment = change.field === "assignedToId" && ticket.hrmsProjectId;
      const headsProject = projectAssignment && headedProjects.includes(projectAssignment);
      if (actor.supportAccess
        ? !canManageTicketOperations(actor) && !permitsSupportAction(actor.supportAccess, ticket.hrmsProjectId, "assign")
        : projectAssignment ? actor.role !== ROLES.ADMIN && !headsProject : !canApplyTicketChange(actor, ticket, change, teamIds)) {
        throw new WorkError(403, "Assignment requires an administrator or the head of this WiseWork project.");
      }
      if (change.field === "status") {
        if (ticket.type === TICKET_TYPE.IMPLEMENTATION && !canManageTicketOperations(actor)) throw new WorkError(403, "Implementation workflow changes require an administrator.");
        if (!statusUpdateOptions(ticket.status, ticket.type).includes(change.value)) throw new WorkError(409, `${ticket.ticketId}: this status transition is not allowed. Use the workflow actions.`);
        if (change.value === STATUS.OPEN_DONE && ticket.status !== STATUS.OPEN_DONE && !change.resolutionSummary) throw new WorkError(400, "Provide a resolution summary before resolving tickets.");
      }
    }
    const changed: string[] = [];
    for (const ticket of tickets) {
      const oldValue = change.field === "dueAt" ? ticket.dueAt?.toISOString() ?? null : ticket[change.field];
      const newValue = change.field === "dueAt" && change.value ? new Date(change.value).toISOString() : change.value;
      if (oldValue === newValue) continue;
      const data: Prisma.TicketUncheckedUpdateInput = change.field === "dueAt"
        ? { dueAt: change.value ? new Date(change.value) : null }
        : { [change.field]: change.value };
      if (change.field === "status") {
        if (change.value === STATUS.OPEN_DONE) Object.assign(data, { resolvedAt: new Date(), aiResolved: false, resolutionSummary: change.resolutionSummary });
        if (change.value === STATUS.CLOSED) data.closedAt = new Date();
      }
      await tx.ticket.update({ where: { id: ticket.id }, data });
      await tx.ticketHistory.create({ data: {
        ticketId: ticket.id, changedById: actor.id,
        field: change.field === "assignedToId" ? "assignee" : change.field === "teamId" ? "team" : change.field,
        oldValue: change.field === "assignedToId" ? ticket.assignedTo?.name ?? null : change.field === "teamId" ? ticket.team?.name ?? null : oldValue,
        newValue: change.field === "assignedToId" ? assigneeName : change.field === "teamId" ? teamName : newValue,
      } });
      changed.push(ticket.ticketId);
    }
    return { updated: changed.length, unchanged: tickets.length - changed.length, ticketIds: changed };
  }, { timeout: 15_000 });
}

/** Existing type/project/hour editors use the same lock and transactional audit. */
export async function updateTicketMetadata(reference: string, actor: StaffActor & SupportActor, data: Prisma.TicketUncheckedUpdateInput, fields: string[]) {
  return prisma.$transaction(async (tx) => {
    const original = await tx.ticket.findUnique({ where: { ticketId: reference }, select: { id: true } });
    if (!original) throw new WorkError(404, "Ticket not found.");
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${original.id}))`;
    const ticket = await tx.ticket.findUniqueOrThrow({ where: { id: original.id } });
    if (actor.supportAccess ? !canManageTicketOperations(actor) : !canEditStaffTicket(actor, ticket)) throw new WorkError(403, "Only the assignee or an administrator can edit this ticket.");
    if (ticket.assignedToId && typeof data.hrmsProjectId === "string" && data.hrmsProjectId !== ticket.hrmsProjectId) {
      throw new WorkError(409, "Unassign the ticket before moving it to another WiseWork project.");
    }
    const result = await tx.ticket.update({ where: { id: ticket.id }, data });
    const value = (record: object, field: string): string | null => {
      const raw = (record as Record<string, unknown>)[field];
      return raw == null ? null : raw instanceof Date ? raw.toISOString() : String(raw);
    };
    for (const field of fields) {
      const oldValue = value(ticket, field);
      const newValue = value(result, field);
      if (oldValue !== newValue) await tx.ticketHistory.create({ data: { ticketId: ticket.id, changedById: actor.id, field, oldValue, newValue } });
    }
  });
}
