import { describe, expect, it } from "vitest";
import { legalNextStatuses, STATUS, TICKET_TYPE } from "@tms/core";
import { CUSTOMER_STATUS } from "./customer-status";

describe("Support platform foundation", () => {
  it("does not offer closure for a newly received support request", () => {
    expect(legalNextStatuses(STATUS.UN_ASSIGNED, TICKET_TYPE.SUPPORT)).toEqual([STATUS.UN_ASSIGNED, STATUS.OPEN_NOT_STARTED]);
    expect(legalNextStatuses(STATUS.OPEN_IN_PROGRESS, TICKET_TYPE.BUG)).toContain(STATUS.WAITING_FOR_CLIENT);
    expect(legalNextStatuses(STATUS.CLOSED, TICKET_TYPE.SUPPORT)).toEqual([STATUS.CLOSED, STATUS.REOPENED]);
  });
  it("requires approval before implementation work", () => {
    expect(legalNextStatuses(STATUS.SUBMITTED, TICKET_TYPE.IMPLEMENTATION)).not.toContain(STATUS.OPEN_IN_PROGRESS);
    expect(legalNextStatuses(STATUS.APPROVED, TICKET_TYPE.IMPLEMENTATION)).toContain(STATUS.OPEN_IN_PROGRESS);
  });
  it("gives customers plain-language statuses", () => {
    expect(CUSTOMER_STATUS.OPEN_QA).toBe("Under review");
    expect(CUSTOMER_STATUS.OPEN_DONE).toBe("Resolved");
    expect(CUSTOMER_STATUS.WAITING_FOR_CLIENT).toBe("Waiting for you");
  });
});
