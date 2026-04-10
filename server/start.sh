#!/bin/sh
set -e

echo "[startup] Running database migrations..."
cd /app/server && bunx prisma migrate deploy

echo "[startup] Seeding admin user..."
cd /app/server && bun run prisma/seed.ts

echo "[startup] Starting server..."
exec bun run /app/server/src/index.ts
