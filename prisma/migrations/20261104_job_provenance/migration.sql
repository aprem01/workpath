-- Job provenance. Additive only.
ALTER TABLE "Job" ADD COLUMN IF NOT EXISTS "source"     TEXT;
ALTER TABLE "Job" ADD COLUMN IF NOT EXISTS "sourceUrl"  TEXT;
ALTER TABLE "Job" ADD COLUMN IF NOT EXISTS "externalId" TEXT;
ALTER TABLE "Job" ADD COLUMN IF NOT EXISTS "lastSeenAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Job_source_externalId_idx" ON "Job"("source", "externalId");
CREATE INDEX IF NOT EXISTS "Job_lastSeenAt_idx"        ON "Job"("lastSeenAt");

-- Employer-posted jobs have known provenance: a recruiter created them.
UPDATE "Job" SET "source" = 'employer', "lastSeenAt" = "postedAt"
WHERE "recruiterEmail" IS NOT NULL AND "source" IS NULL;
