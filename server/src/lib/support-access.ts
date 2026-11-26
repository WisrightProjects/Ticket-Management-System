import { ROLES, z } from "@tms/core";
import type { Prisma } from "../generated/prisma/client.js";

export const supportProfile = z.object({
  sub: z.guid(),
  tenant_id: z.guid(),
  active: z.literal(true),
  support_role: z.enum(["TSA", "PROJECT_LEAD", "MEMBER"]),
  project_ids: z.array(z.string().min(1)),
  led_project_ids: z.array(z.string().min(1)),
});

export type SupportAccess = z.infer<typeof supportProfile>;
export type SupportActor = { supportAccess?: SupportAccess };
export type SupportAction = "read" | "assign" | "note" | "reply";

export function supportProjects(access: SupportAccess | undefined) {
  if (!access || access.support_role === "TSA") return undefined;
  return access.support_role === "PROJECT_LEAD" ? access.led_project_ids : access.project_ids;
}

export function supportTicketScope(access: SupportAccess | undefined): Pick<Prisma.TicketWhereInput, "hrmsProjectId"> {
  const projects = supportProjects(access);
  return projects ? { hrmsProjectId: { in: projects } } : {};
}

export function permitsSupportAction(
  access: SupportAccess,
  projectId: string | null,
  action: SupportAction,
) {
  if (access.support_role === "TSA") return true;
  const projects = supportProjects(access);
  if (!projectId || !projects?.includes(projectId)) return false;
  return action === "read" || action === "note" ||
    (action === "assign" && access.support_role === "PROJECT_LEAD");
}

/** Ticket management is independent of platform administration. */
export function canManageTicketOperations(actor: SupportActor & { role: string }) {
  return actor.supportAccess ? actor.supportAccess.support_role === "TSA" : actor.role === ROLES.ADMIN;
}

export function assignedTicketScope(userId: string, access: SupportAccess | undefined): Prisma.TicketWhereInput {
  return { assignedToId: userId, ...supportTicketScope(access) };
}
