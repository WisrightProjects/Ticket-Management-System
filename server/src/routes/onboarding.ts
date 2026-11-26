import { Router } from "express";
import rateLimit from "express-rate-limit";
import { createHash, randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { z } from "@tms/core";
import { ROLES } from "@tms/core";
import prisma from "../lib/prisma.js";

const router = Router();
router.use(rateLimit({ windowMs: 60_000, max: process.env.NODE_ENV === "test" ? 200 : 20 }));
const tokenSchema = z.string().regex(/^[a-f0-9]{64}$/);
const activationSchema = z.object({ token: tokenSchema, name: z.string().trim().min(1).max(128), password: z.string().min(8).max(128) });
const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");

router.get("/invitation", async (req, res) => {
  const token = tokenSchema.safeParse(req.query.token);
  if (!token.success) { res.status(400).json({ error: "Invalid invitation" }); return; }
  const invite = await prisma.customerInvitation.findFirst({ where: { tokenHash: tokenHash(token.data), acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() }, organization: { isActive: true } }, include: { organization: true } });
  if (!invite) { res.status(404).json({ error: "This invitation has expired or is no longer available" }); return; }
  res.json({ email: invite.email, organization: invite.organization.name });
});

router.post("/activate", async (req, res) => {
  const parsed = activationSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Enter your name and a password of 8–128 characters" }); return; }
  const password = await hashPassword(parsed.data.password);
  try {
    await prisma.$transaction(async (tx) => {
      const invite = await tx.customerInvitation.findFirst({ where: { tokenHash: tokenHash(parsed.data.token), acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() }, organization: { isActive: true } } });
      if (!invite) throw new Error("INVALID_INVITATION");
      const claimed = await tx.customerInvitation.updateMany({ where: { id: invite.id, acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } }, data: { acceptedAt: new Date() } });
      if (claimed.count !== 1) throw new Error("INVALID_INVITATION");
      const userId = randomUUID();
      await tx.user.create({ data: { id: userId, email: invite.email, name: parsed.data.name, role: ROLES.CUSTOMER, isActive: true, emailVerified: true } });
      await tx.account.create({ data: { id: randomUUID(), userId, accountId: userId, providerId: "credential", password } });
      await tx.organizationMembership.create({ data: { id: randomUUID(), userId, organizationId: invite.organizationId, role: invite.role } });
    });
    res.status(201).json({ success: true });
  } catch { res.status(409).json({ error: "This invitation cannot be activated. Ask your administrator for a new invitation." }); }
});
export default router;
