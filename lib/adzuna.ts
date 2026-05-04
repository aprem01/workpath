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
  retail: ["retail", "sales associate", "cashier", "store"],
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
  maxResults: number = 15
): Promise<{ qualified: AdzunaJob[]; broader: AdzunaJob[] }> {
  if (skills.length === 0) {
    return { qualified: [], broader: [] };
  }

  const vertical = detectVerticalFromSkills(skills);
  const keywords = extractKeywords(skills);

  // Search 1: QUALIFIED — top 2 skills joined (Adzuna treats spaces as AND)
  const exactQuery = skills.slice(0, 2).join(" ");
  let exactJobs = await searchAdzunaJobs({
    what: exactQuery,
    where: location,
    results_per_page: maxResults,
    sort_by: "salary",
  });

  // Search 2: BROADER — vertical-safe term if detected, else first skill
  const broaderQuery =
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

  // Dedupe broader against exact
  const exactIds = new Set(exactJobs.map((j) => j.id));
  const candidateBroader = broaderJobs.filter((j) => !exactIds.has(j.id));

  // RELEVANCE FILTER: only keep gap jobs that share ≥1 keyword with the user.
  // This stops "Aviation Lead" appearing for HHA queries.
  const RELEVANCE_THRESHOLD = 1;
  const relevantBroader = candidateBroader.filter(
    (j) => scoreJobRelevance(j, keywords) >= RELEVANCE_THRESHOLD
  );

  return { qualified: exactJobs, broader: relevantBroader };
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
