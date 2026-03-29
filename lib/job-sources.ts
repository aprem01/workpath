/**
 * Job data source configuration.
 * Currently: AI-generated realistic listings + seeded data
 * Future: Real API integrations
 *
 * Planned integrations (in priority order):
 * 1. Adzuna API (free tier: 250 calls/day) — aggregator with salary data
 * 2. The Muse API (free) — company profiles + jobs
 * 3. USAJobs API (free, government) — federal/state jobs
 * 4. Reed API (free tier) — UK + US jobs
 * 5. JSearch (RapidAPI, limited free) — LinkedIn/Indeed aggregator
 */

export interface JobSource {
  name: string;
  type: "api" | "scraper" | "ai_generated" | "manual_seed";
  isActive: boolean;
  rateLimit: string;
  coverage: string;
  apiUrl?: string;
  apiKeyEnv?: string;
}

export const JOB_SOURCES: JobSource[] = [
  {
    name: "Manual Seed",
    type: "manual_seed",
    isActive: true,
    rateLimit: "n/a",
    coverage: "50 Chicago jobs across 7 verticals",
  },
  {
    name: "AI Generated (Claude)",
    type: "ai_generated",
    isActive: true,
    rateLimit: "Per API call cost",
    coverage: "Any vertical, any location — on demand",
  },
  {
    name: "Adzuna",
    type: "api",
    isActive: false,
    rateLimit: "250 calls/day (free)",
    coverage: "US + UK, salary data included",
    apiUrl: "https://api.adzuna.com/v1/api/jobs",
    apiKeyEnv: "ADZUNA_API_KEY",
  },
  {
    name: "USAJobs",
    type: "api",
    isActive: false,
    rateLimit: "Generous (government)",
    coverage: "Federal + state government jobs",
    apiUrl: "https://data.usajobs.gov/api/search",
    apiKeyEnv: "USAJOBS_API_KEY",
  },
  {
    name: "The Muse",
    type: "api",
    isActive: false,
    rateLimit: "Free tier available",
    coverage: "Tech + professional jobs with company profiles",
    apiUrl: "https://www.themuse.com/api/public/jobs",
  },
];

export function getActiveSources(): JobSource[] {
  return JOB_SOURCES.filter(s => s.isActive);
}
