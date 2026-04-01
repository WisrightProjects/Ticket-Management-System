import { Request, Response, NextFunction } from "express";

export function requireWebhookSecret(req: Request, res: Response, next: NextFunction): void {
  const secret = process.env.WEBHOOK_SECRET;
  if (!secret) {
    // No secret configured — allow all (useful in dev/test)
    next();
    return;
  }
  const auth = req.headers["authorization"] ?? "";
  if (auth !== `Bearer ${secret}`) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}
