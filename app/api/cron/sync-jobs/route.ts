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

/**
 * Adzuna rate-limits hard. Firing the page requests back-to-back gets
 * most of them rejected with 429: a burst of 15 concurrent requests on
 * 2026-11-07 returned nine 429s. The old loop treated any non-OK
 * response as "no more pages" and moved on silently, so a throttled run
 * reported success having refreshed 68 postings instead of ~2,500.
 *
 * So: one request at a time, spaced, and a 429 is retried rather than
 * taken as the end of the data.
 */
const REQUEST_SPACING_MS = 1_100;
/** Apply links verified per run, subject to the deadline below. */
const LINK_CHECKS_PER_RUN = 120;
/**
 * Link checks hit www.adzuna.com, not the API, so they do not share the
 * API's rate limit and need less spacing — still spaced, to stay polite.
 */
const LINK_SPACING_MS = 350;
/**
 * Hard wall for the whole run. maxDuration is 300s; being killed at the
 * limit would lose the summary entirely, so stop well short. The first
 * run with both the pull and the sweep took 251s, which was too close.
 */
const RUN_DEADLINE_MS = 265_000;
const MAX_RETRIES = 2;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type PageOutcome =
  | { ok: true; results: Record<string, unknown>[]; sourceCount: number | null }
  | { ok: false; reason: "throttled" | "error" };

async function fetchPage(url: string, lastRequestAt: { at: number }): Promise<PageOutcome> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const since = Date.now() - lastRequestAt.at;
    if (since < REQUEST_SPACING_MS) await sleep(REQUEST_SPACING_MS - since);
    lastRequestAt.at = Date.now();
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(25000),
        // Never serve this from a cache. `dynamic = "force-dynamic"`
        // is supposed to imply it, but every run from 11-08 to 11-22
        // returned a byte-identical result set, so it is stated here
        // explicitly rather than inferred.
        cache: "no-store",
      });
      if (res.status === 429) {
        // Back off further on each retry, then give up on this page.
        await sleep(REQUEST_SPACING_MS * (attempt + 2));
        continue;
      }
      if (!res.ok) return { ok: false, reason: "error" };
      const body = (await res.json()) as {
        results?: Record<string, unknown>[];
        count?: number;
      };
      return {
        ok: true,
        results: body.results ?? [],
        sourceCount: typeof body.count === "number" ? body.count : null,
      };
    } catch {
      if (attempt === MAX_RETRIES) return { ok: false, reason: "error" };
      await sleep(REQUEST_SPACING_MS);
    }
  }
  return { ok: false, reason: "throttled" };
}

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

/**
 * Retire postings whose apply link is explicitly gone.
 *
 * Adzuna keeps returning postings in search results after its own detail
 * pages have started answering 410 Gone, so lastSeenAt never ages them
 * out and a third of open inventory can point at a dead page. Measured
 * 2026-11-22 over 80 random active postings: 29% answered 410, 4% 404.
 *
 * Only 404 and 410 count. A 403 is Adzuna refusing a datacenter IP, not
 * a closed posting — it serves "Access Denied / suspicious behaviour",
 * and 34% of the same sample hit it. Timeouts, 5xx and network errors
 * are equally uninformative. Acting on any of those would retire live
 * jobs, which is worse than keeping a dead link: a jobseeker who cannot
 * find the posting is annoyed, a jobseeker who never sees it is not
 * served at all.
 *
 * Bounded per run and ordered oldest-first, since the oldest postings
 * are the likeliest to be gone. Retirement advances the frontier, so
 * successive runs sweep the whole inventory without a cursor column.
 */
async function retireGonePostings(
  limit: number,
  now: Date,
  deadline: number
): Promise<{
  checked: number;
  gone: number;
  blocked: number;
  inconclusive: number;
  ranOutOfTime: boolean;
}> {
  const candidates = await prisma.job.findMany({
    where: {
      isActive: true,
      recruiterEmail: null,
      source: "adzuna",
      sourceUrl: { not: null },
    },
    orderBy: { postedAt: "asc" },
    take: limit,
    select: { id: true, sourceUrl: true },
  });

  let gone = 0, blocked = 0, inconclusive = 0, checked = 0;
  let ranOutOfTime = false;
  const goneIds: string[] = [];

  for (const job of candidates) {
    if (Date.now() > deadline) { ranOutOfTime = true; break; }
    checked++;
    await sleep(LINK_SPACING_MS);
    try {
      const res = await fetch(job.sourceUrl as string, {
        redirect: "follow",
        signal: AbortSignal.timeout(12000),
        cache: "no-store",
      });
      if (res.status === 404 || res.status === 410) {
        goneIds.push(job.id);
        gone++;
      } else if (res.status === 403) {
        blocked++;
      } else if (!res.ok) {
        inconclusive++;
      }
    } catch {
      inconclusive++;
    }
  }

  if (goneIds.length > 0) {
    await prisma.job.updateMany({
      where: { id: { in: goneIds } },
      data: {
        isActive: false,
        closedAt: now,
        closedReason: "retired: apply link gone (404/410)",
      },
    });
  }

  return { checked, gone, blocked, inconclusive, ranOutOfTime };
}

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

  let pagesOk = 0;
  let pagesThrottled = 0;
  let pagesErrored = 0;
  // How many postings the source actually handed us. "created: 0" is only
  // meaningful next to this: 0 created out of 3,080 fetched means the feed
  // repeated itself, 0 out of 4,950 would mean the create path is broken.
  let fetched = 0;
  // A fingerprint of the first page, so two runs can be compared. If this
  // is identical day after day, the source is repeating, not advancing.
  let firstPageSignature: string | null = null;
  const lastRequestAt = { at: 0 };

  outer: for (const { what, vertical } of SEARCHES) {
    for (let page = 1; page <= PAGES_PER_TERM; page++) {
      if (Date.now() - startedAt > PULL_BUDGET_MS) { budgetHit = true; break outer; }
      {
        const url =
          `https://api.adzuna.com/v1/api/jobs/us/search/${page}?app_id=${appId}&app_key=${appKey}` +
          `&results_per_page=50&where=${encodeURIComponent("Chicago")}` +
          `&what=${encodeURIComponent(what)}&max_days_old=30` +
          // Newest first. Without this Adzuna orders by relevance, and
          // since we only pull PAGES_PER_TERM pages per occupation the
          // new postings never surfaced: page 1 of "caregiver" by
          // relevance held 4 postings from the last three days and
          // reached back to October, where by date it held 50 of 50.
          // A daily incremental sync wants the newest, not the best.
          `&sort_by=date` +
          `&content-type=application/json`;
        const outcome = await fetchPage(url, lastRequestAt);
        if (!outcome.ok) {
          // A rejected page is NOT "no more data". Record it and stop
          // paging this occupation, but never let it look like success.
          if (outcome.reason === "throttled") pagesThrottled++;
          else pagesErrored++;
          break;
        }
        pagesOk++;
        const results = outcome.results;
        fetched += results.length;
        if (firstPageSignature === null) {
          firstPageSignature =
            `${what}|count=${outcome.sourceCount ?? "?"}` +
            `|n=${results.length}` +
            `|first=${String((results[0] as { id?: unknown } | undefined)?.id ?? "none")}`;
        }
        if (results.length === 0) break;

        // Resolve the whole page's 50 postings in two queries instead of
        // 100. The old loop did a findFirst plus an update for every
        // single result, which spent the entire time budget on database
        // round trips and left no room for the request spacing above.
        const pageRows = results
          .map((r) => ({
            r,
            externalId: String((r as { id?: unknown }).id ?? ""),
            sourceUrl: String((r as { redirect_url?: unknown }).redirect_url ?? ""),
          }))
          .filter((x) => x.externalId && x.sourceUrl);
        const ids = pageRows.map((x) => x.externalId);
        const known = new Set(
          (
            await prisma.job.findMany({
              where: { source: "adzuna", externalId: { in: ids } },
              select: { externalId: true },
            })
          ).map((j) => j.externalId as string)
        );
        if (known.size > 0) {
          const { count } = await prisma.job.updateMany({
            where: { source: "adzuna", externalId: { in: Array.from(known) } },
            data: { lastSeenAt: now, isActive: true },
          });
          refreshed += count;
        }

        for (const { r, externalId, sourceUrl } of pageRows) {
          if (known.has(externalId)) continue;
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
      }
    }
  }

  // Only retire when the pull completed. A truncated run has not
  // refreshed every live posting, so retiring here would deactivate jobs
  // that are still open purely because we ran out of time.
  const cutoff = new Date(Date.now() - 30 * 86400000);
  // A run that lost pages to throttling has not re-confirmed every live
  // posting, so retiring on its evidence would deactivate jobs that are
  // still open. Same reasoning as budgetHit.
  const degraded = budgetHit || pagesThrottled + pagesErrored > 0;
  const { count: retiredStale } = degraded ? { count: 0 } : await prisma.job.updateMany({
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

  // Validate apply links only when the pull was clean. A degraded run has
  // already shown the network is against us, and a blocked check would
  // read as inconclusive anyway.
  const linkCheck = degraded
    ? { checked: 0, gone: 0, blocked: 0, inconclusive: 0, ranOutOfTime: false }
    : await retireGonePostings(
        LINK_CHECKS_PER_RUN,
        now,
        startedAt + RUN_DEADLINE_MS
      );

  // The previous run's fingerprint, to tell a repeating feed from one we
  // are simply caught up with.
  const previousSignature = await prisma.analyticsEvent
    .findFirst({
      where: { event: "cron_job_sync" },
      orderBy: { createdAt: "desc" },
      select: { metadata: true },
    })
    .then((row) => {
      if (!row?.metadata) return null;
      try {
        const parsed = JSON.parse(row.metadata) as { firstPageSignature?: unknown };
        return typeof parsed.firstPageSignature === "string"
          ? parsed.firstPageSignature
          : null;
      } catch {
        return null;
      }
    })
    .catch(() => null);

  const openNow = await prisma.job.count({ where: { isActive: true } });
  const summary = {
    created, refreshed, fetched, retiredStale, retiredUnsourced, openNow,
    budgetHit, pagesOk, pagesThrottled, pagesErrored, degraded,
    firstPageSignature,
    linkChecked: linkCheck.checked,
    linkGone: linkCheck.gone,
    linkBlocked: linkCheck.blocked,
    linkInconclusive: linkCheck.inconclusive,
    linkRanOutOfTime: linkCheck.ranOutOfTime,
    // "Created nothing" on its own is not a fault — a run minutes after
    // the last one is simply caught up, and so is a quiet day. The real
    // frozen-feed signature is creating nothing while the source hands
    // back a byte-identical first page, which is what ran unnoticed from
    // 11-08 to 11-22. Comparing the fingerprint with the previous run
    // tells the two apart, so this means the feed stopped advancing
    // rather than merely "nothing new this minute".
    stalled:
      pagesOk > 0 &&
      fetched > 0 &&
      created === 0 &&
      firstPageSignature !== null &&
      firstPageSignature === previousSignature,
  };

  await prisma.analyticsEvent
    .create({ data: { event: "cron_job_sync", metadata: JSON.stringify(summary) } })
    .catch(() => {});

  // Report honestly. A run that silently refreshed 2% of inventory must
  // not answer 200 { success: true }.
  //
  // `stalled` counts too. From 11-08 to 11-22 every run answered 200
  // { success: true } while creating nothing, and because the repeated
  // feed kept refreshing lastSeenAt on the same 3,080 postings, nothing
  // retired either — a frozen feed keeps dead jobs alive indefinitely.
  // A genuinely quiet day will trip this, which is the right trade: a
  // false alarm costs a glance, silence cost fifteen days.
  const unhealthy = degraded || summary.stalled;
  return NextResponse.json(
    { success: !unhealthy, ...summary },
    { status: unhealthy ? 207 : 200 }
  );
}
