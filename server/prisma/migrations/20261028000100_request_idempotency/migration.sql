ALTER TABLE "tickets" ADD COLUMN "submissionKey" TEXT;
CREATE UNIQUE INDEX "tickets_submissionKey_key" ON "tickets"("submissionKey");
