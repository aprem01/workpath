import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Daily job sync. Replaces /api/cron/refresh-jobs, which invented
 * listings attributed to real employers.
 *
 * Two halves:
 *   PULL    — re-fetch Adzuna for the launch verticals. Postings still
 *             listed get lastSeenAt bumped; new ones are inserted with
 *             full provenance and the URL a jobseeker applies at.
 *   RETIRE  — deactivate imported postings the source has stopped
 *             returning, and anything with no provenance at all.
 *
 * Employer-posted jobs are never auto-retired; a recruiter closes their
 * own posting.
 */

const SEARCHES: { what: string; vertical: string }[] = [
  { what: "home health aide", vertical: "home_health_aide" },
  { what: "caregiver", vertical: "home_health_aide" },
  { what: "certified nursing assistant", vertical: "home_health_aide" },
  { what: "personal care aide", vertical: "home_health_aide" },
  { what: "direct support professional", vertical: "home_health_aide" },
  { what: "medical assistant", vertical: "home_health_aide" },
  { what: "patient care technician", vertical: "home_health_aide" },
  { what: "phlebotomist", vertical: "home_health_aide" },
  { what: "dietary aide", vertical: "home_health_aide" },
  { what: "medical receptionist", vertical: "home_health_aide" },
  { what: "warehouse associate", vertical: "transport" },
  { what: "forklift operator", vertical: "transport" },
  { what: "delivery driver", vertical: "transport" },
  { what: "cdl driver", vertical: "transport" },
  { what: "package handler", vertical: "transport" },
  { what: "material handler", vertical: "transport" },
  { what: "shipping receiving", vertical: "transport" },
  { what: "retail sales associate", vertical: "retail" },
  { what: "cashier", vertical: "retail" },
  { what: "stock associate", vertical: "retail" },
  { what: "store manager", vertical: "retail" },
  { what: "merchandiser", vertical: "retail" },
  { what: "line cook", vertical: "food_service" },
  { what: "prep cook", vertical: "food_service" },
  { what: "server restaurant", vertical: "food_service" },
  { what: "dishwasher", vertical: "food_service" },
  { what: "barista", vertical: "food_service" },
  { what: "food service worker", vertical: "food_service" },
  { what: "customer service representative", vertical: "admin" },
  { what: "administrative assistant", vertical: "admin" },
  { what: "data entry clerk", vertical: "admin" },
  { what: "receptionist", vertical: "admin" },
  { what: "call center", vertical: "admin" },
  { what: "maintenance technician", vertical: "trades" },
  { what: "janitor custodian", vertical: "trades" },
  { what: "security guard", vertical: "trades" },
  { what: "housekeeper", vertical: "trades" },
  { what: "landscaper", vertical: "trades" },
];

/** Pages of 50 to pull per occupation. */
const PAGES_PER_TERM = 3;
/**
 * Wall-clock budget. Vercel kills the function at maxDuration, and being
 * killed mid-loop would leave jobs un-refreshed that the retire step then
 * deactivates — live postings disappearing because we ran out of time.
 * Stop pulling well before that and still run the retire step.
 */
const PULL_BUDGET_MS = 230_000;

const SKILL_TERMS = [
  "CPR","First Aid","HHA Certification","CNA","Vital Signs Monitoring","Medication Reminders",
  "Meal Preparation","Light Housekeeping","Mobility Assistance","Companionship","Dementia Care",
  "Personal Care Assistance","Patient Care","Wound Care","Infection Control","Hospice",
  "Forklift Operation","Inventory Management","Warehouse Operations","Shipping and Receiving",
  "Cash Handling","POS Systems","Customer Service","Visual Merchandising","Retail Sales",
  "Food Safety","Food Preparation","Sanitation","Data Entry","Scheduling","Bilingual Spanish",
];

/** Skills are read out of the posting's own words, never inferred. */
function extractSkills(text: string): string[] {
  const hay = ` ${text.toLowerCase()} `;
  const out: string[] = [];
  for (const term of SKILL_TERMS) {
    const t = term.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`\\b${t}\\b`).test(hay) && !out.includes(term)) out.push(term);
  }
  return out;
}

const toHourlyCents = (annual: unknown) =>
  typeof annual === "number" && annual > 0 ? Math.round((annual / 2080) * 100) : null;

export async function GET(req: Request) {
  // Fail closed. An unset CRON_SECRET used to make this compare against
  // the literal string "Bearer undefined", so anyone sending that header
  // could trigger a sync — burning the Adzuna quota and, worse, driving
  // the retire step that deactivates job inventory.
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("cron/sync-jobs: CRON_SECRET unset; refusing to run");
    return NextResponse.json({ error: "Cron not configured" }, { status: 503 });
  }
  const presented = Buffer.from(req.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  // timingSafeEqual throws on length mismatch, so check that first. The
  // length itself is not secret.
  if (
    presented.length !== expected.length ||
    !timingSafeEqual(presented, expected)
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const appId = process.env.ADZUNA_APP_ID;
  const appKey = process.env.ADZUNA_APP_KEY;
  if (!appId || !appKey) {
    // No source configured is a failure, not an excuse to invent rows.
    return NextResponse.json({ error: "ADZUNA credentials missing" }, { status: 503 });
  }

  const now = new Date();
  let created = 0, refreshed = 0;

  const startedAt = Date.now();
  let budgetHit = false;

  outer: for (const { what, vertical } of SEARCHES) {
    for (let page = 1; page <= PAGES_PER_TERM; page++) {
      if (Date.now() - startedAt > PULL_BUDGET_MS) { budgetHit = true; break outer; }
      try {
        const url =
          `https://api.adzuna.com/v1/api/jobs/us/search/${page}?app_id=${appId}&app_key=${appKey}` +
          `&results_per_page=50&where=${encodeURIComponent("Chicago")}` +
          `&what=${encodeURIComponent(what)}&max_days_old=30&content-type=application/json`;
        const res = await fetch(url, { signal: AbortSignal.timeout(25000) });
        if (!res.ok) break;
        const { results } = (await res.json()) as { results?: Record<string, unknown>[] };
        if (!results || results.length === 0) break;
        for (const r of results) {
          const externalId = String((r as { id?: unknown }).id ?? "");
          const sourceUrl = String((r as { redirect_url?: unknown }).redirect_url ?? "");
          if (!externalId || !sourceUrl) continue;

          const existing = await prisma.job.findFirst({
            where: { source: "adzuna", externalId },
            select: { id: true },
          });
          if (existing) {
            await prisma.job.update({
              where: { id: existing.id },
              data: { lastSeenAt: now, isActive: true },
            });
            refreshed++;
            continue;
          }
          const rec = r as Record<string, never>;
          const title = String(rec.title ?? "").replace(/<[^>]+>/g, "").trim();
          const description = String(rec.description ?? "").replace(/<[^>]+>/g, "").trim();
          const skills = extractSkills(`${title} ${description}`);
          await prisma.job.create({
            data: {
              title: title.slice(0, 200),
              employer: String((rec.company as { display_name?: string } | undefined)?.display_name ?? "").trim().slice(0, 160) || "Employer not stated",
              location: String((rec.location as { display_name?: string } | undefined)?.display_name ?? "Chicago, IL").slice(0, 160),
              vertical,
              description: description.slice(0, 4000),
              payMin: toHourlyCents(rec.salary_min),
              payMax: toHourlyCents(rec.salary_max),
              payType: "hourly",
              shiftType: /part[- ]time/i.test(`${title} ${description}`) ? "part_time" : "full_time",
              source: "adzuna",
              sourceUrl,
              externalId,
              lastSeenAt: now,
              postedAt: rec.created ? new Date(String(rec.created)) : now,
              requiredSkills: {
                create: skills.map((sk) => ({ normalizedTerm: sk, proficiencyLevel: "unspecified" })),
              },
            },
          });
          created++;
        }
      } catch {
        // One failed page must not stop the sync or trigger a fallback.
        break;
      }
    }
  }

  // Only retire when the pull completed. A truncated run has not
  // refreshed every live posting, so retiring here would deactivate jobs
  // that are still open purely because we ran out of time.
  const cutoff = new Date(Date.now() - 30 * 86400000);
  const { count: retiredStale } = budgetHit ? { count: 0 } : await prisma.job.updateMany({
    where: {
      isActive: true, recruiterEmail: null, source: { not: null },
      OR: [{ lastSeenAt: null }, { lastSeenAt: { lt: cutoff } }],
    },
    data: { isActive: false, closedAt: now, closedReason: "retired: source stopped listing it (>30d)" },
  });
  const { count: retiredUnsourced } = await prisma.job.updateMany({
    where: { isActive: true, recruiterEmail: null, source: null },
    data: { isActive: false, closedAt: now, closedReason: "retired: no verifiable source" },
  });

  const openNow = await prisma.job.count({ where: { isActive: true } });
  const summary = { created, refreshed, retiredStale, retiredUnsourced, openNow, budgetHit };

  await prisma.analyticsEvent
    .create({ data: { event: "cron_job_sync", metadata: JSON.stringify(summary) } })
    .catch(() => {});

  return NextResponse.json({ success: true, ...summary });
}
