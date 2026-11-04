import { NextResponse } from "next/server";
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
  { what: "warehouse associate", vertical: "transport" },
  { what: "retail sales associate", vertical: "retail" },
  { what: "line cook", vertical: "food_service" },
  { what: "customer service representative", vertical: "admin" },
];

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
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
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

  for (const { what, vertical } of SEARCHES) {
    try {
      const url =
        `https://api.adzuna.com/v1/api/jobs/us/search/1?app_id=${appId}&app_key=${appKey}` +
        `&results_per_page=50&where=${encodeURIComponent("Chicago")}` +
        `&what=${encodeURIComponent(what)}&max_days_old=30&content-type=application/json`;
      const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
      if (!res.ok) continue;
      const { results } = (await res.json()) as { results?: Record<string, unknown>[] };
      for (const r of results || []) {
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
              create: skills.map((s) => ({ normalizedTerm: s, proficiencyLevel: "unspecified" })),
            },
          },
        });
        created++;
      }
    } catch {
      // One failed search must not stop the sync or trigger a fallback.
    }
  }

  const cutoff = new Date(Date.now() - 30 * 86400000);
  const { count: retiredStale } = await prisma.job.updateMany({
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
  const summary = { created, refreshed, retiredStale, retiredUnsourced, openNow };

  await prisma.analyticsEvent
    .create({ data: { event: "cron_job_sync", metadata: JSON.stringify(summary) } })
    .catch(() => {});

  return NextResponse.json({ success: true, ...summary });
}
