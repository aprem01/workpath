/**
 * Adzuna Job Search API integration
 * Free tier: 250 calls/day
 * Docs: https://developer.adzuna.com/
 *
 * To activate:
 * 1. Sign up at https://developer.adzuna.com/
 * 2. Get APP_ID and APP_KEY
 * 3. Set ADZUNA_APP_ID and ADZUNA_APP_KEY in Vercel env vars
 */

export interface AdzunaJob {
  id: string;
  title: string;
  company: { display_name: string };
  location: { display_name: string; area: string[] };
  description: string;
  salary_min: number;
  salary_max: number;
  contract_time: string; // "full_time" | "part_time"
  created: string;
  redirect_url: string;
  category: { tag: string; label: string };
}

interface AdzunaResponse {
  results: AdzunaJob[];
  count: number;
  mean: number;
}

const BASE_URL = "https://api.adzuna.com/v1/api/jobs/us/search/1";

export async function searchAdzunaJobs(params: {
  what: string;           // search keyword
  where?: string;         // location (e.g. "Chicago")
  salary_min?: number;    // min annual salary
  results_per_page?: number;
  sort_by?: "salary" | "date" | "relevance";
}): Promise<AdzunaJob[]> {
  const appId = process.env.ADZUNA_APP_ID;
  const appKey = process.env.ADZUNA_APP_KEY;

  if (!appId || !appKey) {
    console.warn("Adzuna API keys not set — skipping real job search");
    return [];
  }

  const query = new URLSearchParams({
    app_id: appId,
    app_key: appKey,
    what: params.what,
    where: params.where || "Chicago",
    results_per_page: String(params.results_per_page || 10),
    sort_by: params.sort_by || "salary",
  });

  if (params.salary_min) {
    query.set("salary_min", String(params.salary_min));
  }

  try {
    const res = await fetch(`${BASE_URL}?${query}`, {
      headers: { "Content-Type": "application/json" },
      next: { revalidate: 3600 }, // Cache for 1 hour
    });

    if (!res.ok) {
      console.error("Adzuna API error:", res.status, await res.text());
      return [];
    }

    const data: AdzunaResponse = await res.json();
    return data.results || [];
  } catch (e) {
    console.error("Adzuna fetch failed:", e);
    return [];
  }
}

// ─── Vertical detection from user skills ───────────────────────────
// Maps caregiving/healthcare keywords → safe Adzuna search terms that
// actually match real job titles in those fields.
const VERTICAL_KEYWORDS: Record<string, string[]> = {
  healthcare: [
    "home health",
    "caregiver",
    "caregiving",
    "elder care",
    "companion care",
    "personal care",
    "patient care",
    "nursing",
    "nurse",
    "medical",
    "cna",
    "hha",
    "hospice",
    "dialysis",
    "physical therapy",
    "infection control",
    "medication",
    "care plan",
  ],
  trades: [
    "electrician",
    "plumb",
    "hvac",
    "weld",
    "carpenter",
    "solar",
    "construct",
    "roofing",
  ],
  tech: [
    "python",
    "javascript",
    "java",
    "react",
    "sql",
    "data scien",
    "engineer",
    "developer",
    "devops",
  ],
  food: ["cook", "chef", "kitchen", "food", "restaurant", "bar", "cater"],
  transport: ["driver", "truck", "warehouse", "deliver", "logistics"],
  retail: [
    "retail",
    "sales associate",
    "sales",
    "cashier",
    "store",
    "clienteling",
    "luxury",
    "vip experience",
    "visual merchandising",
    "merchandiser",
  ],
};

function detectVerticalFromSkills(skills: string[]): string | null {
  const lower = skills.join(" ").toLowerCase();
  for (const [vertical, keywords] of Object.entries(VERTICAL_KEYWORDS)) {
    if (keywords.some((kw) => lower.includes(kw))) return vertical;
  }
  return null;
}

/**
 * Build a stop-word filtered keyword set from user skills.
 * Strips noise like "and", "services", "management" so matching focuses
 * on the actual occupation/skill words.
 */
const STOP_WORDS = new Set([
  "and", "or", "the", "of", "for", "with", "to", "in", "a", "an",
  "services", "service", "management", "operations", "skills",
  "work", "workers", "occupations", "related", "general",
  "assistance", "coordination", "support",
]);

function extractKeywords(skills: string[]): string[] {
  const words: string[] = [];
  for (const skill of skills) {
    for (const w of skill.toLowerCase().split(/[\s\-/,]+/)) {
      const clean = w.trim();
      if (clean.length >= 3 && !STOP_WORDS.has(clean)) words.push(clean);
    }
  }
  return Array.from(new Set(words));
}

/**
 * Score a job's relevance to the user's skills based on title + description
 * keyword overlap. Higher score = more relevant.
 */
function scoreJobRelevance(job: AdzunaJob, keywords: string[]): number {
  if (keywords.length === 0) return 0;
  const haystack = `${job.title} ${job.description || ""}`.toLowerCase();
  let hits = 0;
  for (const kw of keywords) {
    if (haystack.includes(kw)) hits++;
  }
  return hits;
}

// Round 7 (Desi's Sales basket surfaced Forklift Technician, BMW
// Technician, Automotive Technician): title-level negative keywords
// per vertical, applied in isTitleOffVertical() below.
const OFF_VERTICAL_TITLE_TERMS: Record<string, RegExp> = {
  retail: /\b(technician|mechanic|electrician|plumber|hvac|welder|forklift|automotive|bmw|diesel|nurse|physician|therapist|attorney|paralegal)\b/i,
  healthcare: /\b(diesel|forklift|welder|electrician|carpenter|plumber|bartender|sommelier|automotive|mechanic)\b/i,
  trades: /\b(nurse|physician|attorney|paralegal|accountant|cashier|bartender)\b/i,
  food: /\b(nurse|physician|attorney|electrician|plumber|technician|forklift|automotive)\b/i,
  transport: /\b(nurse|physician|attorney|cashier|bartender|chef)\b/i,
  tech: /\b(nurse|physician|therapist|cashier|forklift|welder|plumber|electrician|hvac|automotive)\b/i,
};

function isTitleOffVertical(title: string, vertical: string | null): boolean {
  if (!vertical) return false;
  const rx = OFF_VERTICAL_TITLE_TERMS[vertical];
  return rx ? rx.test(title) : false;
}

/**
 * Search Adzuna with user skills, returning qualified + broader (gap) results.
 *
 * Strategy:
 *  - Detect vertical from skills (healthcare, trades, tech, etc)
 *  - Use vertical-safe search terms when available (e.g. "home health aide"
 *    instead of Claude's verbose "Home Health Aide Services")
 *  - Score every result against user keywords; drop low-relevance results
 *  - Returns empty arrays if nothing meets relevance threshold (better than
 *    showing Aviation Lead jobs to a Home Health Aide)
 */
export async function searchJobsForSkills(
  skills: string[],
  location: string = "Chicago",
  maxResults: number = 15,
  domainQueries?: { primary: string; broad: string } | null
): Promise<{ qualified: AdzunaJob[]; broader: AdzunaJob[] }> {
  if (skills.length === 0 && !domainQueries) {
    return { qualified: [], broader: [] };
  }

  const vertical = detectVerticalFromSkills(skills);
  const keywords = extractKeywords(skills);

  // Caroline 7/18 Round 5: the landing-page domain picker was removed in
  // Round 4, so `domainQueries` is null for every user now. The skill-join
  // fallback below returns zero Adzuna hits for realistic baskets like
  // ["Home Health Assistance", "Meal Preparation"] because no job title
  // contains both phrases. When no domain is set, derive queries from the
  // detected vertical instead — restores the "guided search" that made
  // Round 3 matching work.
  const VERTICAL_QUERIES: Record<string, { primary: string; broad: string }> = {
    healthcare: { primary: "home health aide caregiver", broad: "caregiver" },
    trades: { primary: "electrician plumber technician", broad: "skilled trades" },
    tech: { primary: "software engineer developer", broad: "developer" },
    food: { primary: "cook restaurant kitchen", broad: "food service" },
    transport: { primary: "driver delivery warehouse", broad: "driver" },
    retail: { primary: "sales associate cashier", broad: "retail" },
  };
  const effectiveQueries =
    domainQueries ||
    (vertical && VERTICAL_QUERIES[vertical]) ||
    null;

  const exactQuery = effectiveQueries?.primary || skills.slice(0, 2).join(" ");

  let exactJobs = await searchAdzunaJobs({
    what: exactQuery,
    where: location,
    results_per_page: maxResults,
    sort_by: "salary",
  });

  // Broader query: curated domain-broad term if available, else vertical
  // fallback, else the first skill.
  const broaderQuery =
    effectiveQueries?.broad ||
    (vertical &&
      VERTICAL_KEYWORDS[vertical].find((kw) =>
        skills.some((s) => s.toLowerCase().includes(kw))
      )) ||
    skills[0];

  const broaderJobs = await searchAdzunaJobs({
    what: broaderQuery,
    where: location,
    results_per_page: 30,
    sort_by: "salary",
  });

  // FALLBACK: if exact returned nothing, promote broader to qualified
  if (exactJobs.length === 0 && broaderJobs.length > 0) {
    exactJobs = broaderJobs.slice(0, maxResults);
  }

  // RELEVANCE FILTER applies to BOTH qualified and gap jobs.
  // Caroline's beta tester Rosalyn (Chipotle manager) reported getting
  // physician + attorney jobs in Tab A — that was the unfiltered Adzuna
  // dump. Now Tab A also requires keyword overlap with user skills.
  // Tab A uses higher threshold (≥2) so qualified is more confident;
  // Tab B uses ≥1 since by definition the user is "1-2 skills away".
  const QUALIFIED_THRESHOLD = 2;
  const GAP_THRESHOLD = 1;

  // Drop obviously off-vertical noise up-front (Desi's Forklift/BMW/
  // Automotive Technician surfacing for a Sales basket). Cheap title-
  // regex is enough — if the title says "Technician" and the user is
  // in retail, no scoreJobRelevance boost saves it.
  const onVertical = (j: AdzunaJob) => !isTitleOffVertical(j.title, vertical);
  const exactOnVertical = exactJobs.filter(onVertical);
  const broaderOnVertical = broaderJobs.filter(onVertical);

  let relevantQualified = exactOnVertical.filter(
    (j) => scoreJobRelevance(j, keywords) >= QUALIFIED_THRESHOLD
  );
  // If the strict threshold killed everything, fall back to ≥1 so the
  // user still sees results (better than empty)
  if (relevantQualified.length === 0 && exactOnVertical.length > 0) {
    relevantQualified = exactOnVertical.filter(
      (j) => scoreJobRelevance(j, keywords) >= GAP_THRESHOLD
    );
  }

  // Dedupe broader against (filtered) qualified
  const qualifiedIds = new Set(relevantQualified.map((j) => j.id));
  const candidateBroader = broaderOnVertical.filter((j) => !qualifiedIds.has(j.id));
  const relevantBroader = candidateBroader.filter(
    (j) => scoreJobRelevance(j, keywords) >= GAP_THRESHOLD
  );

  return { qualified: relevantQualified, broader: relevantBroader };
}

// Caroline 7/28 Round 7: "With 1–2 More Skills: +0 Additional Jobs" was
// the biggest miss. When a user's basket qualifies them for the entry
// tier of their vertical, Adzuna's broad-query results were often
// deduped/filtered to zero because they overlapped with the qualified
// tier. We now maintain an explicit UPSKILL TIER — the next rung of
// jobs whose keywords are DIFFERENT from the qualified tier — and
// what cert/skill unlocks them. Use fetchUpskillTier() when Tab B
// comes back empty.
export const UPSKILL_TIERS: Record<
  string,
  Array<{ query: string; missingSkill: string }>
> = {
  healthcare: [
    { query: "certified nursing assistant CNA", missingSkill: "CNA Certification" },
    { query: "home health aide certified", missingSkill: "HHA Certification" },
    { query: "medical assistant certified", missingSkill: "Medical Assistant Certification" },
    { query: "phlebotomist certified", missingSkill: "Phlebotomy Certification" },
    { query: "dialysis technician", missingSkill: "Dialysis Technician Training" },
    { query: "hospice aide certified", missingSkill: "Hospice Care Training" },
    { query: "CPR first aid instructor", missingSkill: "CPR / First Aid Certification" },
  ],
  retail: [
    { query: "store manager retail", missingSkill: "Retail Management Training" },
    { query: "assistant store manager", missingSkill: "Assistant Manager Training" },
    { query: "visual merchandiser", missingSkill: "Visual Merchandising Training" },
    { query: "retail sales supervisor", missingSkill: "Team Leadership Certification" },
    { query: "sales training coordinator", missingSkill: "Sales Training Certification" },
    { query: "retail operations coordinator", missingSkill: "Retail Operations Training" },
  ],
  trades: [
    { query: "electrician journeyman", missingSkill: "Journeyman Electrician License" },
    { query: "plumber licensed", missingSkill: "Plumbing License" },
    { query: "HVAC technician certified", missingSkill: "EPA 608 Certification" },
    { query: "OSHA certified construction", missingSkill: "OSHA-10 or OSHA-30" },
    { query: "solar installer NABCEP", missingSkill: "NABCEP Certification" },
  ],
  tech: [
    { query: "junior developer", missingSkill: "Portfolio + Git basics" },
    { query: "IT support specialist", missingSkill: "CompTIA A+ Certification" },
    { query: "data analyst SQL", missingSkill: "SQL + Excel fluency" },
    { query: "cybersecurity analyst entry", missingSkill: "Security+ Certification" },
  ],
  food: [
    { query: "kitchen manager", missingSkill: "ServSafe Manager Certification" },
    { query: "sous chef", missingSkill: "Culinary Certification" },
    { query: "restaurant manager", missingSkill: "Restaurant Management Training" },
    { query: "bartender certified", missingSkill: "Bartending License / TIPS" },
  ],
  transport: [
    { query: "CDL truck driver class A", missingSkill: "CDL Class A License" },
    { query: "warehouse supervisor", missingSkill: "Warehouse Management Training" },
    { query: "forklift certified operator", missingSkill: "Forklift Certification" },
    { query: "dispatch coordinator", missingSkill: "Logistics Coordinator Training" },
  ],
};

/**
 * Fetch the "upskill tier" jobs for a vertical — one Adzuna call per
 * tier query, capped at maxTiers. Each returned job comes tagged with
 * the missingSkill that would unlock it (drives the Explore Skills
 * training-resource lookups downstream).
 */
export async function fetchUpskillTier(
  vertical: string | null,
  location: string,
  maxTiers: number = 4
): Promise<Array<AdzunaJob & { _missingSkill: string }>> {
  if (!vertical) return [];
  const tiers = UPSKILL_TIERS[vertical];
  if (!tiers || tiers.length === 0) return [];
  const chosen = tiers.slice(0, maxTiers);
  const results = await Promise.all(
    chosen.map(async (t) => {
      try {
        const jobs = await searchAdzunaJobs({
          what: t.query,
          where: location,
          results_per_page: 3,
          sort_by: "salary",
        });
        // Tag each with the missing skill that unlocks it
        return jobs.map((j) => ({ ...j, _missingSkill: t.missingSkill }));
      } catch {
        return [];
      }
    })
  );
  return results.flat();
}

/**
 * Convert Adzuna job to our internal format and save to DB
 */
export function adzunaToInternal(job: AdzunaJob, vertical: string) {
  // Convert annual salary to hourly cents (assume 2080 hours/year)
  const hourlyMin = job.salary_min ? Math.round((job.salary_min / 2080) * 100) : 1500;
  const hourlyMax = job.salary_max ? Math.round((job.salary_max / 2080) * 100) : 2500;

  return {
    title: job.title,
    employer: job.company?.display_name || "Company",
    location: job.location?.display_name || "Chicago, IL",
    description: job.description?.substring(0, 500) || "",
    payMin: hourlyMin,
    payMax: hourlyMax,
    payType: "hourly" as const,
    shiftType: job.contract_time === "part_time" ? "part_time" : "full_time",
    vertical,
    isActive: true,
  };
}
