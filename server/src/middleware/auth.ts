import { Request, Response, NextFunction } from "express";
import { auth } from "../lib/auth.js";
import { fromNodeHeaders } from "better-auth/node";

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });

  if (!session) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  if (!(session.user as any).isActive) {
    res.status(403).json({ error: "Account is deactivated" });
    return;
  }

  (req as any).user = session.user;
  (req as any).session = session.session;
  next();
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  await requireAuth(req, res, () => {
    if ((req as any).user?.role !== "ADMIN") {
      res.status(403).json({ error: "Admin access required" });
      return;
    }
    next();
  });
}
