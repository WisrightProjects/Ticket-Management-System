ALTER TABLE "tickets" ADD COLUMN "resolutionSummary" TEXT;
CREATE INDEX "tickets_organizationId_requesterId_idx" ON "tickets"("organizationId", "requesterId");
