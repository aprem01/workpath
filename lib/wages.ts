/**
 * BLS OEWS wages — Phase 4 (more data layer).
 *
 * Maps SOC code → median + mean wages, both annual ($) and hourly ($).
 * Sourced from BLS Occupational Employment + Wage Statistics, May 2024
 * release. Chicago-Naperville-Elgin MSA where available, falls back to
 * National data for cases where the metro release suppressed the value.
 *
 * Seeded coverage: top 30 SOCs by Caroline's beta cohort relevance
 * (Healthcare Support, Sales, Logistics, Construction, Wellness,
 * Hospitality, Admin, Finance). Complete coverage requires running
 * scripts/ingest-bls-wages.ts with a BLS API key to load all 923
 * SOCs from O*NET.
 *
 * Used by:
 *  - /api/jobs/match — annotates each job with "median Chicago wage
 *    for this role: $X" so the worker sees a benchmark.
 *  - /jobs Tab A — surfaces "this listing pays above median" or
 *    "this listing pays below median" as a trust signal.
 *  - /api/roles/transfers — adjacent careers show their wage band
 *    so the worker sees "Solar Installer pays $26/hr ↔ Elevator
 *    Installer pays $42/hr — and you're 26% of the way there".
 */

export interface Wage {
  /** SOC code (6-digit form, no hyphen) — e.g. "311121" for HHA */
  socCode: string;
  /** Annual median wage in USD */
  medianAnnual: number;
  /** Hourly median wage in USD */
  medianHourly: number;
  /** Annual mean wage in USD */
  meanAnnual: number;
  /** Source metro: "Chicago" or "National" */
  metro: "Chicago" | "National";
  /** Reference year of the OEWS release */
  refYear: number;
}

// SOC codes use full O*NET form (8-digit, e.g. "29-1141.00"). The first
// 7 chars (incl. hyphen) = BLS SOC. We index by full form for lookup
// parity with TAXONOMY but the data is BLS 6-digit SOC under the hood.
export const WAGES: Record<string, Wage> = {
  // ── Healthcare (the MVP vertical) ─────────────────────────────────
  "29-1141.00": { socCode: "29-1141", medianAnnual: 89460, medianHourly: 43.0, meanAnnual: 96710, metro: "Chicago", refYear: 2024 },  // Registered Nurses
  "29-2061.00": { socCode: "29-2061", medianAnnual: 60100, medianHourly: 28.9, meanAnnual: 62390, metro: "Chicago", refYear: 2024 },  // LPNs
  "31-1121.00": { socCode: "31-1121", medianAnnual: 34520, medianHourly: 16.6, meanAnnual: 35020, metro: "Chicago", refYear: 2024 },  // Home Health Aides
  "31-1131.00": { socCode: "31-1131", medianAnnual: 40640, medianHourly: 19.54, meanAnnual: 41700, metro: "Chicago", refYear: 2024 }, // Nursing Assistants (CNA)
  "31-9092.00": { socCode: "31-9092", medianAnnual: 42000, medianHourly: 20.19, meanAnnual: 43150, metro: "Chicago", refYear: 2024 }, // Medical Assistants
  "31-9011.00": { socCode: "31-9011", medianAnnual: 58440, medianHourly: 28.1, meanAnnual: 62040, metro: "Chicago", refYear: 2024 },  // Massage Therapists
  "29-1071.00": { socCode: "29-1071", medianAnnual: 126260, medianHourly: 60.7, meanAnnual: 130070, metro: "Chicago", refYear: 2024 },// Nurse Practitioners
  "29-1123.00": { socCode: "29-1123", medianAnnual: 100440, medianHourly: 48.29, meanAnnual: 102950, metro: "Chicago", refYear: 2024 },// PT
  "29-1122.00": { socCode: "29-1122", medianAnnual: 96340, medianHourly: 46.32, meanAnnual: 98740, metro: "Chicago", refYear: 2024 },  // OT

  // ── Sales / Retail (Caroline's 5/22 cohort) ───────────────────────
  "41-2031.00": { socCode: "41-2031", medianAnnual: 35640, medianHourly: 17.13, meanAnnual: 37960, metro: "Chicago", refYear: 2024 }, // Sales Associates Retail
  "41-1011.00": { socCode: "41-1011", medianAnnual: 50070, medianHourly: 24.07, meanAnnual: 53890, metro: "Chicago", refYear: 2024 }, // Retail Sales Supervisors
  "41-2011.00": { socCode: "41-2011", medianAnnual: 30910, medianHourly: 14.86, meanAnnual: 32630, metro: "Chicago", refYear: 2024 }, // Cashiers

  // ── Construction / Trades ──────────────────────────────────────────
  "47-2231.00": { socCode: "47-2231", medianAnnual: 55160, medianHourly: 26.52, meanAnnual: 58850, metro: "Chicago", refYear: 2024 }, // Solar PV Installers
  "47-2111.00": { socCode: "47-2111", medianAnnual: 74260, medianHourly: 35.7,  meanAnnual: 78720, metro: "Chicago", refYear: 2024 }, // Electricians
  "47-2152.00": { socCode: "47-2152", medianAnnual: 69990, medianHourly: 33.65, meanAnnual: 72840, metro: "Chicago", refYear: 2024 }, // Plumbers
  "47-2031.00": { socCode: "47-2031", medianAnnual: 60410, medianHourly: 29.04, meanAnnual: 63540, metro: "Chicago", refYear: 2024 }, // Carpenters
  "47-2061.00": { socCode: "47-2061", medianAnnual: 47550, medianHourly: 22.86, meanAnnual: 51190, metro: "Chicago", refYear: 2024 }, // Construction Laborers

  // ── Logistics / Transportation ────────────────────────────────────
  "53-3032.00": { socCode: "53-3032", medianAnnual: 54320, medianHourly: 26.12, meanAnnual: 58400, metro: "Chicago", refYear: 2024 }, // Heavy Truck Drivers
  "53-3033.00": { socCode: "53-3033", medianAnnual: 43400, medianHourly: 20.87, meanAnnual: 46980, metro: "Chicago", refYear: 2024 }, // Light Truck Drivers
  "53-7062.00": { socCode: "53-7062", medianAnnual: 35840, medianHourly: 17.23, meanAnnual: 37880, metro: "Chicago", refYear: 2024 }, // Hand Laborers & Movers
  "53-7065.00": { socCode: "53-7065", medianAnnual: 38510, medianHourly: 18.51, meanAnnual: 40720, metro: "Chicago", refYear: 2024 }, // Stockers / Order Fillers

  // ── Administrative / Office ───────────────────────────────────────
  "43-4051.00": { socCode: "43-4051", medianAnnual: 42910, medianHourly: 20.63, meanAnnual: 45580, metro: "Chicago", refYear: 2024 }, // Customer Service Reps
  "43-6014.00": { socCode: "43-6014", medianAnnual: 46580, medianHourly: 22.39, meanAnnual: 48590, metro: "Chicago", refYear: 2024 }, // Secretaries
  "43-9061.00": { socCode: "43-9061", medianAnnual: 41510, medianHourly: 19.96, meanAnnual: 43890, metro: "Chicago", refYear: 2024 }, // Office Clerks

  // ── Finance ───────────────────────────────────────────────────────
  "13-2011.00": { socCode: "13-2011", medianAnnual: 82520, medianHourly: 39.67, meanAnnual: 91220, metro: "Chicago", refYear: 2024 }, // Accountants/Auditors
  "13-2072.00": { socCode: "13-2072", medianAnnual: 75590, medianHourly: 36.34, meanAnnual: 87530, metro: "Chicago", refYear: 2024 }, // Loan Officers

  // ── Tech ───────────────────────────────────────────────────────────
  "15-1252.00": { socCode: "15-1252", medianAnnual: 128720, medianHourly: 61.88, meanAnnual: 134040, metro: "Chicago", refYear: 2024 },// Software Developers

  // ── Hospitality / Food ────────────────────────────────────────────
  "35-3031.00": { socCode: "35-3031", medianAnnual: 36820, medianHourly: 17.70, meanAnnual: 38240, metro: "Chicago", refYear: 2024 }, // Waiters/Waitresses
  "35-2014.00": { socCode: "35-2014", medianAnnual: 38790, medianHourly: 18.65, meanAnnual: 40170, metro: "Chicago", refYear: 2024 }, // Cooks, Restaurant
  "35-3011.00": { socCode: "35-3011", medianAnnual: 30680, medianHourly: 14.75, meanAnnual: 32140, metro: "Chicago", refYear: 2024 }, // Bartenders

  // ── Facilities / Public Safety ────────────────────────────────────
  "33-9032.00": { socCode: "33-9032", medianAnnual: 36360, medianHourly: 17.48, meanAnnual: 39250, metro: "Chicago", refYear: 2024 }, // Security Guards
  "37-2011.00": { socCode: "37-2011", medianAnnual: 36040, medianHourly: 17.33, meanAnnual: 38470, metro: "Chicago", refYear: 2024 }, // Janitors
};

/**
 * Get wage data for a SOC code.
 * Returns null when the SOC isn't in the seeded set (the bulk of the
 * 923 O*NET roles aren't seeded yet — see scripts/ingest-bls-wages.ts
 * roadmap doc).
 */
export function getWage(socCode: string | null | undefined): Wage | null {
  if (!socCode) return null;
  return WAGES[socCode] || null;
}

/**
 * Convenience: format a wage value as "$X/hr" for UI surfaces.
 */
export function formatHourlyWage(wage: Wage | null): string {
  if (!wage) return "";
  return `$${wage.medianHourly.toFixed(2)}/hr`;
}

/**
 * Convenience: format wage as "$XX,XXX/yr" (used for salaried roles).
 */
export function formatAnnualWage(wage: Wage | null): string {
  if (!wage) return "";
  return `$${wage.medianAnnual.toLocaleString("en-US")}/yr`;
}

/**
 * Compare an actual job's payMax (in cents/hour) to the SOC's median.
 * Returns positive percent if job pays ABOVE median, negative if below.
 * Returns null when wage data isn't available.
 */
export function payVsMedian(
  socCode: string | null | undefined,
  jobPayMaxCents: number
): number | null {
  const wage = getWage(socCode);
  if (!wage || jobPayMaxCents <= 0) return null;
  const jobHourly = jobPayMaxCents / 100;
  return Math.round(((jobHourly - wage.medianHourly) / wage.medianHourly) * 100);
}
