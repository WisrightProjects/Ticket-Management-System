import { describe, expect, test } from "bun:test";
import { bulkTicketSchema, queueQuerySchema, canApplyTicketChange, ROLES, STATUS } from "@tms/core";
import { queueScope, queueFilters } from "./work-queue";

const agent = { id: "agent-1", role: ROLES.AGENT };
const admin = { id: "admin-1", role: ROLES.ADMIN };
describe("Staff queue policy", () => {
  test("overdue uses explicit deadlines and excludes completed work", () => {
    const now = new Date("2026-10-28T10:00:00Z");
    expect(queueScope("overdue", agent.id, [], now)).toEqual({ status: { notIn: [STATUS.OPEN_DONE, STATUS.CLOSED] }, dueAt: { lt: now } });
    expect(queueScope("teams", agent.id, [])).toEqual({ status: { notIn: [STATUS.OPEN_DONE, STATUS.CLOSED] }, teamId: { in: [] } });
  });
  test("queue predicates compose with search and organization filters", () => {
    const query = queueQuerySchema.parse({ search: " payroll ", organizationId: "org-one", queue: "mine" });
    const filters = queueFilters(query);
    expect(filters.organizationId).toBe("org-one");
    expect(filters.OR).toHaveLength(4);
    expect(queueScope("mine", agent.id, [])).toHaveProperty("assignedToId", agent.id);
  });
  test("validates bulk boundaries before any database work", () => {
    expect(bulkTicketSchema.safeParse({ ticketIds: ["TKT-1", "TKT-1"], change: { field: "priority", value: "HIGH" } }).success).toBe(false);
    expect(bulkTicketSchema.safeParse({ ticketIds: [], change: { field: "priority", value: "HIGH" } }).success).toBe(false);
    expect(queueQuerySchema.safeParse({ pageSize: 1000 }).success).toBe(false);
    expect(bulkTicketSchema.safeParse({ ticketIds: ["TKT-1"], change: { field: "dueAt", value: "yesterday" } }).success).toBe(false);
  });
  test("agents can claim their team's unassigned work but cannot take another person's ticket", () => {
    const change = { field: "assignedToId" as const, value: agent.id };
    expect(canApplyTicketChange(agent, { assignedToId: null, teamId: "team-a" }, change, ["team-a"])).toBe(true);
    expect(canApplyTicketChange(agent, { assignedToId: null, teamId: "team-b" }, change, ["team-a"])).toBe(false);
    expect(canApplyTicketChange(agent, { assignedToId: "agent-2", teamId: null }, change, [])).toBe(false);
  });
  test("agents cannot change deadlines, teams or another assignee", () => {
    const own = { assignedToId: agent.id, teamId: null };
    expect(canApplyTicketChange(agent, own, { field: "teamId", value: null }, [])).toBe(false);
    expect(canApplyTicketChange(agent, own, { field: "dueAt", value: null }, [])).toBe(false);
    expect(canApplyTicketChange(agent, own, { field: "assignedToId", value: "someone-else" }, [])).toBe(false);
    expect(canApplyTicketChange(agent, own, { field: "priority", value: "HIGH" }, [])).toBe(true);
    expect(canApplyTicketChange(admin, own, { field: "dueAt", value: null }, [])).toBe(true);
    expect(canApplyTicketChange({ id: "customer", role: ROLES.CUSTOMER }, own, { field: "priority", value: "HIGH" }, [])).toBe(false);
  });
});
