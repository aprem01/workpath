-- Mirrors the Skilmatch migration of the same name. Both apps share one
-- database; this keeps Prisma's migration history consistent for each.
ALTER TABLE "Job" ALTER COLUMN "payMin" DROP NOT NULL;
ALTER TABLE "Job" ALTER COLUMN "payMax" DROP NOT NULL;
