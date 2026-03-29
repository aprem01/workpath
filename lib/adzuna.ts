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
