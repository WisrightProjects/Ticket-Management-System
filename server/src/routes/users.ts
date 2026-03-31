import { Router, Request, Response } from "express";
import { hashPassword } from "better-auth/crypto";
import prisma from "../lib/prisma.js";
import { requireAdmin } from "../middleware/auth.js";

const router = Router();

// All routes require admin
router.use(requireAdmin);

// GET /api/users — list all users
router.get("/", async (_req: Request, res: Response) => {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  res.json(users);
});

// POST /api/users — create a new user
router.post("/", async (req: Request, res: Response) => {
  const { name, email, password, role } = req.body;

  if (!name || !email || !password) {
    res.status(400).json({ error: "Name, email, and password are required" });
    return;
  }

  if (password.length < 8) {
    res.status(400).json({ error: "Password must be at least 8 characters" });
    return;
  }

  const validRoles = ["ADMIN", "AGENT"];
  if (role && !validRoles.includes(role)) {
    res.status(400).json({ error: "Role must be ADMIN or AGENT" });
    return;
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    res.status(409).json({ error: "A user with this email already exists" });
    return;
  }

  const hashedPassword = await hashPassword(password);
  const userId = crypto.randomUUID();

  const user = await prisma.user.create({
    data: {
      id: userId,
      name,
      email,
      role: role || "AGENT",
      emailVerified: true,
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
    },
  });

  await prisma.account.create({
    data: {
      id: crypto.randomUUID(),
      userId,
      accountId: userId,
      providerId: "credential",
      password: hashedPassword,
    },
  });

  res.status(201).json(user);
});

// PUT /api/users/:id — update user name, email, role, and optionally password
router.put("/:id", async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const { name, email, role, password } = req.body;

  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  if (email && email !== existing.email) {
    const emailTaken = await prisma.user.findUnique({ where: { email } });
    if (emailTaken) {
      res.status(409).json({ error: "A user with this email already exists" });
      return;
    }
  }

  const validRoles = ["ADMIN", "AGENT"];
  if (role && !validRoles.includes(role)) {
    res.status(400).json({ error: "Role must be ADMIN or AGENT" });
    return;
  }

  if (password && password.length < 8) {
    res.status(400).json({ error: "Password must be at least 8 characters" });
    return;
  }

  const user = await prisma.user.update({
    where: { id },
    data: {
      ...(name && { name }),
      ...(email && { email }),
      ...(role && { role }),
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
    },
  });

  if (password) {
    const hashedPassword = await hashPassword(password);
    await prisma.account.updateMany({
      where: { userId: id, providerId: "credential" },
      data: { password: hashedPassword },
    });
  }

  res.json(user);
});

// PATCH /api/users/:id/status — activate/deactivate user
router.patch("/:id/status", async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const { isActive } = req.body;

  if (typeof isActive !== "boolean") {
    res.status(400).json({ error: "isActive must be a boolean" });
    return;
  }

  // Prevent admin from deactivating themselves
  const currentUser = (req as any).user;
  if (currentUser.id === id && !isActive) {
    res.status(400).json({ error: "You cannot deactivate your own account" });
    return;
  }

  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const user = await prisma.user.update({
    where: { id },
    data: { isActive },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
    },
  });

  res.json(user);
});

export default router;
