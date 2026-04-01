import { z } from "zod";

// ──────────────────────────────────────
// Constants
// ──────────────────────────────────────

export const TICKET_TYPES = ["BUG", "REQUIREMENT", "TASK", "SUPPORT"] as const;
export const PRIORITIES   = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export const STATUSES     = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"] as const;

export type TicketTypeValue = (typeof TICKET_TYPES)[number];
export type PriorityValue   = (typeof PRIORITIES)[number];
export type StatusValue     = (typeof STATUSES)[number];

export type TicketStatus   = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
export type TicketCategory = "BUG" | "REQUIREMENT" | "TASK" | "SUPPORT";

// Named constants — use these instead of string literals
export const TICKET_TYPE = {
  BUG:         "BUG",
  REQUIREMENT: "REQUIREMENT",
  TASK:        "TASK",
  SUPPORT:     "SUPPORT",
} as const satisfies Record<string, TicketTypeValue>;

export const PRIORITY = {
  LOW:      "LOW",
  MEDIUM:   "MEDIUM",
  HIGH:     "HIGH",
  CRITICAL: "CRITICAL",
} as const satisfies Record<string, PriorityValue>;

export const STATUS = {
  OPEN:        "OPEN",
  IN_PROGRESS: "IN_PROGRESS",
  RESOLVED:    "RESOLVED",
  CLOSED:      "CLOSED",
} as const satisfies Record<string, StatusValue>;

// ──────────────────────────────────────
// API response schema
// Used by the client to validate data returned from GET /api/tickets
// ──────────────────────────────────────

export const apiTicketSchema = z.object({
  id:          z.string(),
  ticketId:    z.string(),
  title:       z.string(),
  description: z.string(),
  type:        z.enum(TICKET_TYPES),
  priority:    z.enum(PRIORITIES),
  status:      z.enum(STATUSES),
  project:     z.string(),
  assignedTo:  z.object({ id: z.string(), name: z.string() }).nullable(),
  createdBy:   z.object({ id: z.string(), name: z.string() }),
  createdAt:   z.string(),
  updatedAt:   z.string(),
});

export const apiTicketsSchema = z.array(apiTicketSchema);
export type ApiTicket = z.infer<typeof apiTicketSchema>;

// ──────────────────────────────────────
// Inbound email webhook schema
// Used by POST /api/webhooks/email
// ──────────────────────────────────────

export const inboundEmailSchema = z.object({
  from:    z.string().email("Must be a valid email address"),
  name:    z.string().optional(),
  subject: z.string().min(1, "Subject is required").max(255, "Subject must be 255 characters or fewer"),
  body:    z.string().min(1, "Body is required"),
});

export type InboundEmail = z.infer<typeof inboundEmailSchema>;
