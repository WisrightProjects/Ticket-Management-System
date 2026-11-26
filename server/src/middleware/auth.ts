import prisma from "../lib/prisma.js";
import { loadSupportAccess } from "../lib/wisework-sso.js";
import { Request, Response, NextFunction } from "express";
import { auth } from "../lib/auth.js";
import { fromNodeHeaders } from "better-auth/node";
import { ROLES } from "@tms/core";

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });

  if (!session) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const supportAccess = await loadSupportAccess(session.user.id);
  if (!(session.user as any).isActive || supportAccess === null) {
    await prisma.session.deleteMany({ where: { id: session.session.id } });
    res.status(401).json({ error: "Your access has ended. Sign in again." });
    return;
  }

  req.user = { ...session.user, supportAccess } as typeof req.user;
  req.session = session.session as any;
  next();
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  await requireAuth(req, res, () => {
    if (req.user?.role !== ROLES.ADMIN || req.user.supportAccess) {
      res.status(403).json({ error: "Admin access required" });
      return;
    }
    next();
  });
}
