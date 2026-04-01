import { Router } from "express";
import { randomUUID } from "node:crypto";
import { inboundEmailSchema, TICKET_TYPE, PRIORITY, STATUS, ROLES } from "@tms/core";
import prisma from "../lib/prisma.js";

const router = Router();

// POST /api/webhooks/email
// Accepts a simulated inbound email payload and creates a ticket.
router.post("/email", async (req, res) => {
  const result = inboundEmailSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ fieldErrors: result.error.flatten().fieldErrors });
    return;
  }

  const { from, name, subject, body } = result.data;

  // Find a system admin to set as ticket creator
  const admin = await prisma.user.findFirst({ where: { role: ROLES.ADMIN } });
  if (!admin) {
    res.status(500).json({ error: "No admin user found to assign as ticket creator" });
    return;
  }

  // Generate next ticket ID (TKT-XXXX) — use a transaction to avoid races
  const ticket = await prisma.$transaction(async (tx) => {
    const latest = await tx.ticket.findFirst({
      orderBy: { ticketId: "desc" },
      select: { ticketId: true },
    });

    let nextNumber = 1;
    if (latest) {
      const match = latest.ticketId.match(/^TKT-(\d+)$/);
      if (match) nextNumber = parseInt(match[1], 10) + 1;
    }

    const ticketId = `TKT-${String(nextNumber).padStart(4, "0")}`;
    const description = name
      ? `From: ${name} <${from}>\n\n${body}`
      : `From: ${from}\n\n${body}`;

    return tx.ticket.create({
      data: {
        id:          randomUUID(),
        ticketId,
        title:       subject,
        description,
        type:        TICKET_TYPE.SUPPORT,
        priority:    PRIORITY.MEDIUM,
        status:      STATUS.OPEN,
        project:     "Email Intake",
        createdById: admin.id,
      },
      select: { id: true, ticketId: true },
    });
  });

  res.status(201).json({ ticketId: ticket.ticketId, id: ticket.id });
});

export default router;
