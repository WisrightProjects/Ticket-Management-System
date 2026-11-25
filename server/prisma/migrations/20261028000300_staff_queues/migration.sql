CREATE TABLE "Team" (
  "id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL UNIQUE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "TeamMember" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "teamId" TEXT NOT NULL REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "userId" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  UNIQUE ("teamId", "userId")
);
CREATE INDEX "TeamMember_userId_idx" ON "TeamMember"("userId");
CREATE TABLE "QueueView" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "name" TEXT NOT NULL, "filters" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("userId", "name")
);
ALTER TABLE "tickets" ADD COLUMN "teamId" TEXT REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD COLUMN "dueAt" TIMESTAMP(3);
CREATE INDEX "tickets_teamId_status_idx" ON "tickets"("teamId", "status");
CREATE INDEX "tickets_assignedToId_status_idx" ON "tickets"("assignedToId", "status");
CREATE INDEX "tickets_dueAt_status_idx" ON "tickets"("dueAt", "status");
