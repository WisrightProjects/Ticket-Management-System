import { Request, Response, NextFunction } from "express";
import { timingSafeEqual } from "node:crypto";

export function requireWebhookSecret(req: Request, res: Response, next: NextFunction): void {
  const secret = process.env.WEBHOOK_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "test") {
      next();
      return;
    }
    res.status(500).json({ error: "Server misconfiguration: WEBHOOK_SECRET is not set." });
    return;
  }
  const auth = req.headers["authorization"] ?? "";
  const expected = `Bearer ${secret}`;
  // Use constant-time comparison to prevent timing attacks
  const valid =
    auth.length === expected.length &&
    timingSafeEqual(Buffer.from(auth), Buffer.from(expected));
  if (!valid) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}
