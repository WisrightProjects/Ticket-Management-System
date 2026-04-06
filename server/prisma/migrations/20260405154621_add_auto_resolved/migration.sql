-- Add NEW and PROCESSING values to the Status enum
ALTER TYPE "Status" ADD VALUE IF NOT EXISTS 'NEW' BEFORE 'OPEN';
ALTER TYPE "Status" ADD VALUE IF NOT EXISTS 'PROCESSING' BEFORE 'RESOLVED';

-- Change default status on tickets from OPEN to NEW
ALTER TABLE "tickets" ALTER COLUMN "status" SET DEFAULT 'NEW';
