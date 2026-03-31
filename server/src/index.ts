import http from "http";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import dotenv from "dotenv";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./lib/auth.js";
import userRoutes from "./routes/users.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Security headers
app.use(helmet());

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || "http://localhost:5173",
  credentials: true,
}));

app.use(express.json({ limit: "50kb" }));
app.use(express.urlencoded({ extended: true, limit: "50kb" }));

// Rate limiting (production only)
const isProd = process.env.NODE_ENV === "production";

if (isProd) {
  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use("/api", apiLimiter);
}

// Stricter rate limit for auth (production only, applied in http.createServer)
const authRateLimit = new Map<string, { count: number; resetAt: number }>();
function isAuthRateLimited(ip: string): boolean {
  if (!isProd) return false;
  const now = Date.now();
  const entry = authRateLimit.get(ip);
  if (!entry || now > entry.resetAt) {
    authRateLimit.set(ip, { count: 1, resetAt: now + 15 * 60 * 1000 });
    return false;
  }
  entry.count++;
  return entry.count > 20; // max 20 auth requests per 15 min
}

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

// API routes
app.use("/api/users", userRoutes);

// Create HTTP server — route /api/auth to Better Auth, rest to Express
const betterAuthHandler = toNodeHandler(auth);
const server = http.createServer((req, res) => {
  if (req.url?.startsWith("/api/auth/sign-in")) {
    const ip = req.socket.remoteAddress || "unknown";
    if (isAuthRateLimited(ip)) {
      res.writeHead(429, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Too many login attempts. Try again later." }));
      return;
    }
  }
  if (req.url?.startsWith("/api/auth")) {
    betterAuthHandler(req, res);
  } else {
    app(req, res);
  }
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

export default app;
