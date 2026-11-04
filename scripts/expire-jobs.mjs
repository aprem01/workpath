/**
 * Retire job postings that are no longer current.
 *
 * Three rules, in order of confidence:
 *
 *  1. NO PROVENANCE → retire. A job that cannot say where it came from
 *     cannot be trusted. 1,618 rows were invented by a model and
 *     attributed to real employers (Northwestern Memorial, the CTA,
 *     Nordstrom), with no apply URL, so nobody could ever have applied.
 *     These are retired regardless of age.
 *
 *  2. NOT SEEN RECENTLY → retire. An imported posting the source has
 *     stopped returning is filled or withdrawn. Default 30 days.
 *
 *  3. Employer-posted jobs are never auto-retired. A recruiter closes
 *     their own posting; we don't decide that for them.
 *
 * Retiring sets isActive=false and records a reason. Nothing is deleted,
 * so a mistake is reversible and the history stays auditable.
 *
 * Usage: node scripts/expire-jobs.mjs [--days=30] [--dry]
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const DRY = process.argv.includes("--dry");
const DAYS = Number((process.argv.find(a => a.startsWith("--days=")) || "").split("=")[1]) || 30;
const cutoff = new Date(Date.now() - DAYS * 86400000);

async function retire(where, reason, label) {
  const n = await prisma.job.count({ where });
  if (!DRY && n) {
    await prisma.job.updateMany({
      where,
      data: { isActive: false, closedAt: new Date(), closedReason: reason },
    });
  }
  console.log(`  ${String(n).padStart(5)}  ${label}`);
  return n;
}

console.log(`${DRY ? "[dry run] " : ""}retiring jobs (not-seen cutoff: ${DAYS} days)\n`);

const noProvenance = await retire(
  { isActive: true, recruiterEmail: null, source: null },
  "retired: no verifiable source",
  "no provenance — cannot prove this posting was ever real"
);

const stale = await retire(
  { isActive: true, recruiterEmail: null, source: { not: null },
    OR: [{ lastSeenAt: null }, { lastSeenAt: { lt: cutoff } }] },
  `retired: source stopped listing it (>${DAYS}d)`,
  `imported but not seen in ${DAYS} days`
);

const open = await prisma.job.count({ where: { isActive: true } });
const withSource = await prisma.job.count({ where: { isActive: true, source: { not: null } } });
const applicable = await prisma.job.count({ where: { isActive: true, sourceUrl: { not: null } } });
const employer = await prisma.job.count({ where: { isActive: true, recruiterEmail: { not: null } } });

console.log(`\n  retired this run: ${noProvenance + stale}`);
console.log(`\nREMAINING OPEN JOBS`);
console.log(`  total                    : ${open}`);
console.log(`  with a recorded source   : ${withSource}`);
console.log(`  a jobseeker can apply to : ${applicable}`);
console.log(`  posted by an employer    : ${employer}`);
await prisma.$disconnect();
