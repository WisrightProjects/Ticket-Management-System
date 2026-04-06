import {
  TICKET_TYPE,
  PRIORITY,
  STATUS,
  type ApiTicket,
  type TicketTypeValue,
  type PriorityValue,
  type StatusValue,
} from "@tms/core";

export type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

export function priorityVariant(p: ApiTicket["priority"]): BadgeVariant {
  if (p === PRIORITY.CRITICAL || p === PRIORITY.HIGH) return "destructive";
  if (p === PRIORITY.MEDIUM) return "default";
  return "secondary";
}

export function statusVariant(s: ApiTicket["status"]): BadgeVariant {
  if (s === STATUS.OPEN || s === STATUS.IN_PROGRESS) return "default";
  if (s === STATUS.NEW || s === STATUS.PROCESSING)   return "secondary";
  if (s === STATUS.RESOLVED)                         return "outline";
  return "outline";
}

export function typeVariant(t: ApiTicket["type"]): BadgeVariant {
  if (t === TICKET_TYPE.BUG) return "destructive";
  if (t === TICKET_TYPE.SUPPORT) return "default";
  return "secondary";
}

export const CATEGORY_LABELS: Record<TicketTypeValue, string> = {
  [TICKET_TYPE.BUG]:         "Bug",
  [TICKET_TYPE.REQUIREMENT]: "Requirement",
  [TICKET_TYPE.TASK]:        "Task",
  [TICKET_TYPE.SUPPORT]:     "Support",
};

export const PRIORITY_LABELS: Record<PriorityValue, string> = {
  [PRIORITY.LOW]:      "Low",
  [PRIORITY.MEDIUM]:   "Medium",
  [PRIORITY.HIGH]:     "High",
  [PRIORITY.CRITICAL]: "Critical",
};

export const STATUS_LABELS: Record<StatusValue, string> = {
  [STATUS.NEW]:         "New",
  [STATUS.OPEN]:        "Open",
  [STATUS.IN_PROGRESS]: "In Progress",
  [STATUS.PROCESSING]:  "Processing",
  [STATUS.RESOLVED]:    "Resolved",
  [STATUS.CLOSED]:      "Closed",
};
