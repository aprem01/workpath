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

/**
 * Search Adzuna with user skills, returning qualified (exact) and broader (gap) results.
 *
 * Strategy:
 *  - QUALIFIED = search using ALL user skills (intersection — narrower, higher relevance)
 *  - GAP = search using just the TOP skill or vertical keyword (broader — more results,
 *          some of which the user is "1-2 skills away" from)
 */
export async function searchJobsForSkills(
  skills: string[],
  location: string = "Chicago",
  maxResults: number = 15
): Promise<{ qualified: AdzunaJob[]; broader: AdzunaJob[] }> {
  if (skills.length === 0) {
    return { qualified: [], broader: [] };
  }

  // Search 1: QUALIFIED — intersection of all skills (or top 3 if many)
  // Adzuna treats space-separated terms as AND, so this is restrictive
  const exactQuery = skills.slice(0, 3).join(" ");
  const exactJobs = await searchAdzunaJobs({
    what: exactQuery,
    where: location,
    results_per_page: maxResults,
    sort_by: "salary",
  });

  // Search 2: GAP — use just the FIRST skill so we get many jobs in the same field.
  // The exact-match dedupe removes already-qualified ones, leaving "close but not exact" jobs
  // that the user is 1-2 skills away from.
  const broaderQuery = skills[0] || "";
  const broaderJobs = await searchAdzunaJobs({
    what: broaderQuery,
    where: location,
    results_per_page: 20,
    sort_by: "salary",
  });

  // Dedupe broader (remove jobs already in exact results)
  const exactIds = new Set(exactJobs.map((j) => j.id));
  let uniqueBroader = broaderJobs.filter((j) => !exactIds.has(j.id));

  // If still no gap jobs, do one more search without the user's most specific skill
  // (search using a broader category term derived from the skill)
  if (uniqueBroader.length === 0 && skills.length >= 2) {
    const fallbackJobs = await searchAdzunaJobs({
      what: skills[skills.length - 1], // last skill = often broader
      where: location,
      results_per_page: 15,
      sort_by: "salary",
    });
    uniqueBroader = fallbackJobs.filter((j) => !exactIds.has(j.id));
  }

  return { qualified: exactJobs, broader: uniqueBroader };
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
