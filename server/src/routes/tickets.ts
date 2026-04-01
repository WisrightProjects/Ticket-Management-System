import { Router, type Request, type Response } from "express";
import { requireAuth } from "../middleware/auth.js";
import prisma from "../lib/prisma.js";
import { ticketQuerySchema } from "@tms/core";
import { Prisma } from "../generated/prisma/client.js";

const router = Router();

// All ticket routes require authentication
router.use(requireAuth);

// GET /api/tickets — list all tickets with optional sorting and filtering
router.get("/", async (req, res) => {
  const result = ticketQuerySchema.safeParse(req.query);
  if (!result.success) {
    res.status(400).json({ error: "Invalid query parameters" });
    return;
  }

  const { sortBy, sortOrder, search, status, priority, type, page, pageSize } = result.data;

  const where: Prisma.TicketWhereInput = {};
  if (search)   where.title    = { contains: search, mode: "insensitive" };
  if (status)   where.status   = status;
  if (priority) where.priority = priority;
  if (type)     where.type     = type;

  const select = {
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
    assignedTo: { select: { id: true, name: true } },
    createdBy:  { select: { id: true, name: true } },
  } as const;

  const [data, total] = await Promise.all([
    prisma.ticket.findMany({
      where,
      orderBy: { [sortBy]: sortOrder },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select,
    }),
    prisma.ticket.count({ where }),
  ]);

  res.json({ data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
});

// GET /api/tickets/:id — fetch a single ticket by ticketId (e.g. TKT-0001)
router.get("/:id", async (req: Request<{ id: string }>, res: Response) => {
  const ticket = await prisma.ticket.findUnique({
    where: { ticketId: req.params.id },
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
      assignedTo: { select: { id: true, name: true } },
      createdBy:  { select: { id: true, name: true } },
    },
  });

  if (!ticket) {
    res.status(404).json({ error: "Ticket not found" });
    return;
  }

  res.json(ticket);
});

export default router;
