import { describe, expect, test } from "bun:test";
import { assignedTicketScope, canManageTicketOperations, permitsSupportAction, supportProfile, supportTicketScope, type SupportAccess } from "./support-access";

const employee = {
  sub: "33000000-0000-0000-0000-000000000054",
  tenant_id: "a0000000-0000-0000-0000-000000000001",
  active: true as const,
  project_ids: ["assigned"],
  led_project_ids: ["led"],
};
const actions = ["read", "assign", "note", "reply"] as const;

describe("WiseWork support-role matrix", () => {
  const cases = [
    ["TSA", "led", [true, true, true, true]],
    ["TSA", "unrelated", [true, true, true, true]],
    ["TSA", null, [true, true, true, true]],
    ["PROJECT_LEAD", "led", [true, true, true, false]],
    ["PROJECT_LEAD", "assigned", [false, false, false, false]],
    ["PROJECT_LEAD", "unrelated", [false, false, false, false]],
    ["PROJECT_LEAD", null, [false, false, false, false]],
    ["MEMBER", "assigned", [true, false, true, false]],
    ["MEMBER", "led", [false, false, false, false]],
    ["MEMBER", "unrelated", [false, false, false, false]],
    ["MEMBER", null, [false, false, false, false]],
  ] as const;
  for (const [support_role, project, decisions] of cases) {
    for (const [index, action] of actions.entries()) {
      test(`${support_role}: ${action} on ${project ?? "unprojected"}`, () => {
        expect(permitsSupportAction({ ...employee, support_role }, project, action)).toBe(decisions[index]);
      });
    }
  }

  test("list scope uses only the role's own project claim", () => {
    expect(supportTicketScope({ ...employee, support_role: "TSA" })).toEqual({});
    expect(supportTicketScope({ ...employee, support_role: "PROJECT_LEAD" })).toEqual({ hrmsProjectId: { in: ["led"] } });
    expect(supportTicketScope({ ...employee, support_role: "MEMBER" })).toEqual({ hrmsProjectId: { in: ["assigned"] } });
    const empty: SupportAccess = { ...employee, support_role: "MEMBER", project_ids: [] };
    expect(supportTicketScope(empty)).toEqual({ hrmsProjectId: { in: [] } });
  });

  test("NONE, inactive, missing and malformed claims grant no support access", () => {
    for (const claims of [
      { ...employee, support_role: "NONE" },
      { ...employee, support_role: "TSA", active: false },
      employee,
      { ...employee, support_role: "PROJECT_LEAD", led_project_ids: null },
      { ...employee, support_role: "ADMIN" },
    ]) expect(supportProfile.safeParse(claims).success).toBe(false);
  });
});

test("ticket operations recognize TSA separately from platform roles", () => {
  expect(canManageTicketOperations({ role: "AGENT", supportAccess: { ...employee, support_role: "TSA" } })).toBe(true);
  expect(canManageTicketOperations({ role: "ADMIN", supportAccess: { ...employee, support_role: "PROJECT_LEAD" } })).toBe(false);
  expect(canManageTicketOperations({ role: "ADMIN", supportAccess: { ...employee, support_role: "MEMBER" } })).toBe(false);
  expect(canManageTicketOperations({ role: "ADMIN" })).toBe(true);
  expect(canManageTicketOperations({ role: "AGENT" })).toBe(false);
});

test("My Tickets composes direct assignment with each permitted role's visibility", () => {
  expect(assignedTicketScope("staff-1", { ...employee, support_role: "TSA" })).toEqual({ assignedToId: "staff-1" });
  expect(assignedTicketScope("staff-1", { ...employee, support_role: "PROJECT_LEAD" }))
    .toEqual({ assignedToId: "staff-1", hrmsProjectId: { in: ["led"] } });
  expect(assignedTicketScope("staff-1", { ...employee, support_role: "MEMBER" }))
    .toEqual({ assignedToId: "staff-1", hrmsProjectId: { in: ["assigned"] } });
  expect(assignedTicketScope("staff-1", undefined)).toEqual({ assignedToId: "staff-1" });
});
