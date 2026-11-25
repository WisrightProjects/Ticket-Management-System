CREATE TABLE "Organization" (
 "id" TEXT PRIMARY KEY, "name" TEXT NOT NULL, "slug" TEXT NOT NULL UNIQUE,
 "hrmsClientId" TEXT UNIQUE, "isActive" BOOLEAN NOT NULL DEFAULT true,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "OrganizationMembership" (
 "id" TEXT PRIMARY KEY, "userId" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
 "organizationId" TEXT NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
 "role" TEXT NOT NULL DEFAULT 'MEMBER', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE("userId", "organizationId")
);
CREATE TABLE "CustomerInvitation" (
 "id" TEXT PRIMARY KEY, "email" TEXT NOT NULL,
 "organizationId" TEXT NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
 "role" TEXT NOT NULL DEFAULT 'MEMBER', "tokenHash" TEXT NOT NULL UNIQUE,
 "expiresAt" TIMESTAMP(3) NOT NULL, "acceptedAt" TIMESTAMP(3), "revokedAt" TIMESTAMP(3),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "CustomerInvitation_organizationId_email_idx" ON "CustomerInvitation"("organizationId", "email");
ALTER TABLE "tickets" ADD COLUMN "organizationId" TEXT REFERENCES "Organization"("id"),
 ADD COLUMN "requesterId" TEXT REFERENCES "user"("id"),
 ADD COLUMN "firstResponseAt" TIMESTAMP(3), ADD COLUMN "resolvedAt" TIMESTAMP(3),
 ADD COLUMN "closedAt" TIMESTAMP(3), ADD COLUMN "aiResolved" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "comments" ADD COLUMN "isInternal" BOOLEAN NOT NULL DEFAULT false;

-- Backfill only explicit legacy client associations; ambiguous/unmapped records remain
-- inaccessible to customers until reviewed. Do not infer membership from email domains.
INSERT INTO "Organization" ("id", "name", "slug", "hrmsClientId")
 SELECT 'legacy-' || md5(client_id), MAX(client_name), 'legacy-' || md5(client_id), client_id
 FROM (
  SELECT "hrmsClientId" client_id, COALESCE("hrmsClientName", "hrmsClientId") client_name
  FROM "tickets" WHERE "hrmsClientId" IS NOT NULL
  UNION ALL
  SELECT "portalClientId", "portalClientId" FROM "user"
  WHERE "role" = 'CUSTOMER' AND "portalClientId" IS NOT NULL
 ) legacy GROUP BY client_id;
UPDATE "tickets" t SET "organizationId" = o."id"
 FROM "Organization" o WHERE t."hrmsClientId" = o."hrmsClientId";
INSERT INTO "OrganizationMembership" ("id", "userId", "organizationId")
 SELECT 'legacy-' || md5(u."id" || o."id"), u."id", o."id"
 FROM "user" u JOIN "Organization" o ON u."portalClientId" = o."hrmsClientId"
 WHERE u."role" = 'CUSTOMER';
UPDATE "tickets" t SET "requesterId" = u."id"
 FROM "user" u JOIN "OrganizationMembership" m ON m."userId" = u."id"
 WHERE lower(t."senderEmail") = lower(u."email") AND t."organizationId" = m."organizationId";
