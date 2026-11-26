import { beforeEach, describe, expect, mock, test } from "bun:test";
import { ROLES } from "@tms/core";

type Fixture = { id: string; ticketId: string; status: "OPEN_NOT_STARTED" | "UN_ASSIGNED"; type: "SUPPORT"; priority: "MEDIUM"; assignedToId: string | null; hrmsProjectId?: string; teamId: null; dueAt: null; assignedTo: null; team: null };
let fixtures: Fixture[];
let writes: unknown[];
let events: unknown[];
const tx = {
  $executeRaw: async () => undefined,
  ticket: {
    findMany: async (query: { where: { ticketId?: { in: string[] }; id?: { in: string[] } }; include?: unknown }) =>
      fixtures.filter((ticket) => query.where.ticketId?.in.includes(ticket.ticketId) || query.where.id?.in.includes(ticket.id)),
    update: async (query: unknown) => { writes.push(query); return {}; },
  },
  teamMember: { findMany: async () => [] },
  user: { findFirst: async () => ({ name: "Member", email: "member@example.test" }) },
  ticketHistory: { create: async (query: unknown) => { events.push(query); return {}; } },
};
mock.module("./prisma.js", () => ({ default: {
  $transaction: async (run: (client: typeof tx) => unknown) => run(tx),
  ticket: { findMany: async () => fixtures.filter((ticket) => ticket.hrmsProjectId) },
  user: { findUnique: async ({ where }: { where: { id: string } }) => ({ email: `${where.id}@example.test` }) },
} }));
mock.module("./hrms.js", () => ({
  getProjectEmployees: async (id: string) => id === "project-a" ? [{ email: "member@example.test" }] : [],
  getStaffHeadedProjects: async (email: string) => email === "head@example.test" ? ["project-a"] : [],
}));
const { applyStaffTicketChange, WorkError } = await import("./staff-ticket-service");

beforeEach(() => {
  writes = []; events = [];
  fixtures = ["1", "2"].map((id) => ({ id, ticketId: `TKT-${id}`, status: id === "1" ? "OPEN_NOT_STARTED" : "UN_ASSIGNED", type: "SUPPORT", priority: "MEDIUM", assignedToId: null, teamId: null, dueAt: null, assignedTo: null, team: null }));
});
describe("Atomic bulk validation", () => {
  test("a later illegal transition prevents all writes", async () => {
    await expect(applyStaffTicketChange(["TKT-1", "TKT-2"], { id: "admin", role: ROLES.ADMIN }, { field: "status", value: "OPEN_IN_PROGRESS" })).rejects.toBeInstanceOf(WorkError);
    expect(writes).toHaveLength(0); expect(events).toHaveLength(0);
  });
  test("a missing ticket is an error rather than a partial update", async () => {
    await expect(applyStaffTicketChange(["TKT-1", "TKT-2", "TKT-3"], { id: "admin", role: ROLES.ADMIN }, { field: "priority", value: "HIGH" })).rejects.toMatchObject({ status: 404 });
    expect(writes).toHaveLength(0);
  });
  test("ownership is checked for every selected ticket", async () => {
    fixtures[0]!.assignedToId = "agent";
    await expect(applyStaffTicketChange(["TKT-1", "TKT-2"], { id: "agent", role: ROLES.AGENT }, { field: "priority", value: "HIGH" })).rejects.toMatchObject({ status: 403 });
    expect(writes).toHaveLength(0);
  });
  test("successful changes create an audit event for every updated ticket", async () => {
    const result = await applyStaffTicketChange(["TKT-1", "TKT-2"], { id: "admin", role: ROLES.ADMIN }, { field: "priority", value: "HIGH" });
    expect(result.updated).toBe(2); expect(writes).toHaveLength(2); expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({ data: { changedById: "admin", field: "priority", oldValue: "MEDIUM", newValue: "HIGH" } });
  });
  test("project heads can assign a project member but other agents cannot", async () => {
    fixtures[0]!.hrmsProjectId = "project-a";
    const change = { field: "assignedToId", value: "member" } as const;
    await expect(applyStaffTicketChange(["TKT-1"], { id: "agent", role: ROLES.AGENT }, change)).rejects.toMatchObject({ status: 403 });
    await expect(applyStaffTicketChange(["TKT-1"], { id: "head", role: ROLES.AGENT }, change)).resolves.toMatchObject({ updated: 1 });
  });
  test("a project membership mismatch prevents all assignments in a batch", async () => {
    fixtures[0]!.hrmsProjectId = "project-a";
    fixtures[1]!.hrmsProjectId = "project-b";
    await expect(applyStaffTicketChange(["TKT-1", "TKT-2"], { id: "admin", role: ROLES.ADMIN }, { field: "assignedToId", value: "member" })).rejects.toMatchObject({ status: 400 });
    expect(writes).toHaveLength(0);
  });
});
