import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import prisma from "../lib/prisma.js";

const router = Router();

// All ticket routes require authentication
router.use(requireAuth);

// GET /api/tickets — list all tickets, newest first
router.get("/", async (_req, res) => {
  const tickets = await prisma.ticket.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id:          true,
      ticketId:    true,
      title:       true,
      description: true,
      type:        true,
      priority:    true,
      status:      true,
      project:     true,
      createdAt:   true,
      updatedAt:   true,
      assignedTo: {
        select: { id: true, name: true },
      },
      createdBy: {
        select: { id: true, name: true },
      },
    },
  });

  res.json(tickets);
});

export default router;
