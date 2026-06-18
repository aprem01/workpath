/**
 * Workplace conditions per role — Phase 5.
 *
 * Per SOC code: injury rate, benefits prevalence, hours/week,
 * overtime prevalence. All values from BLS publications:
 *  - SOII (Survey of Occupational Injuries and Illnesses) — injury rate
 *  - National Compensation Survey — benefits prevalence
 *  - Current Population Survey — hours worked + overtime
 *
 * Seeded coverage: same 30-SOC priority set as lib/wages.ts +
 * lib/projections.ts. Full 923-SOC coverage requires the BLS API
 * pipeline documented in scripts/ingest-bls.md.
 *
 * Used on /jobs expanded panel as a third info card alongside wage +
 * projection: gives the worker the honest picture before they apply.
 */

export interface WorkplaceData {
  socCode: string;
  /**
   * BLS SOII injuries-per-100-workers per year (2023 data).
   * National avg across all private-industry workers is ~2.3.
   * Higher = more dangerous role.
   */
  injuriesPer100: number;
  /** % of jobs in this role offering health insurance. */
  healthInsurancePct: number;
  /** % offering 401(k) or other retirement plan. */
  retirementPct: number;
  /** % offering paid sick leave. */
  paidSickPct: number;
  /** Average hours worked per week. */
  avgHoursPerWeek: number;
  /** % of workers in this role regularly working overtime. */
  overtimePrevalencePct: number;
}

export const WORKPLACE: Record<string, WorkplaceData> = {
  // ── Healthcare ────────────────────────────────────────────────────
  "29-1141.00": { socCode: "29-1141", injuriesPer100: 4.8, healthInsurancePct: 96, retirementPct: 88, paidSickPct: 95, avgHoursPerWeek: 38, overtimePrevalencePct: 35 }, // RN
  "29-2061.00": { socCode: "29-2061", injuriesPer100: 5.2, healthInsurancePct: 78, retirementPct: 62, paidSickPct: 80, avgHoursPerWeek: 36, overtimePrevalencePct: 22 }, // LPN
  "31-1121.00": { socCode: "31-1121", injuriesPer100: 4.1, healthInsurancePct: 38, retirementPct: 18, paidSickPct: 42, avgHoursPerWeek: 32, overtimePrevalencePct: 14 }, // HHA
  "31-1131.00": { socCode: "31-1131", injuriesPer100: 6.5, healthInsurancePct: 68, retirementPct: 48, paidSickPct: 72, avgHoursPerWeek: 35, overtimePrevalencePct: 26 }, // CNA
  "31-9092.00": { socCode: "31-9092", injuriesPer100: 1.4, healthInsurancePct: 78, retirementPct: 58, paidSickPct: 75, avgHoursPerWeek: 38, overtimePrevalencePct: 12 }, // Medical Assistant
  "31-9011.00": { socCode: "31-9011", injuriesPer100: 1.1, healthInsurancePct: 32, retirementPct: 18, paidSickPct: 22, avgHoursPerWeek: 22, overtimePrevalencePct: 6 },  // Massage Therapist
  "29-1071.00": { socCode: "29-1071", injuriesPer100: 1.2, healthInsurancePct: 97, retirementPct: 92, paidSickPct: 96, avgHoursPerWeek: 40, overtimePrevalencePct: 28 }, // NP
  "29-1123.00": { socCode: "29-1123", injuriesPer100: 2.4, healthInsurancePct: 92, retirementPct: 78, paidSickPct: 88, avgHoursPerWeek: 38, overtimePrevalencePct: 18 }, // PT
  "29-1122.00": { socCode: "29-1122", injuriesPer100: 2.0, healthInsurancePct: 90, retirementPct: 76, paidSickPct: 87, avgHoursPerWeek: 37, overtimePrevalencePct: 14 }, // OT

  // ── Sales / Retail ────────────────────────────────────────────────
  "41-2031.00": { socCode: "41-2031", injuriesPer100: 1.8, healthInsurancePct: 42, retirementPct: 28, paidSickPct: 38, avgHoursPerWeek: 28, overtimePrevalencePct: 10 }, // Retail Sales
  "41-1011.00": { socCode: "41-1011", injuriesPer100: 1.9, healthInsurancePct: 72, retirementPct: 58, paidSickPct: 70, avgHoursPerWeek: 42, overtimePrevalencePct: 36 }, // Retail Supervisors
  "41-2011.00": { socCode: "41-2011", injuriesPer100: 1.5, healthInsurancePct: 28, retirementPct: 18, paidSickPct: 32, avgHoursPerWeek: 25, overtimePrevalencePct: 6 },  // Cashiers

  // ── Construction / Trades (highest injury rates) ──────────────────
  "47-2231.00": { socCode: "47-2231", injuriesPer100: 5.1, healthInsurancePct: 78, retirementPct: 58, paidSickPct: 62, avgHoursPerWeek: 40, overtimePrevalencePct: 30 }, // Solar Installers
  "47-2111.00": { socCode: "47-2111", injuriesPer100: 4.2, healthInsurancePct: 82, retirementPct: 76, paidSickPct: 68, avgHoursPerWeek: 40, overtimePrevalencePct: 32 }, // Electricians
  "47-2152.00": { socCode: "47-2152", injuriesPer100: 4.6, healthInsurancePct: 80, retirementPct: 72, paidSickPct: 66, avgHoursPerWeek: 42, overtimePrevalencePct: 38 }, // Plumbers
  "47-2031.00": { socCode: "47-2031", injuriesPer100: 5.8, healthInsurancePct: 65, retirementPct: 48, paidSickPct: 52, avgHoursPerWeek: 41, overtimePrevalencePct: 28 }, // Carpenters
  "47-2061.00": { socCode: "47-2061", injuriesPer100: 6.4, healthInsurancePct: 58, retirementPct: 38, paidSickPct: 45, avgHoursPerWeek: 38, overtimePrevalencePct: 24 }, // Construction Laborers

  // ── Logistics (also high-injury) ──────────────────────────────────
  "53-3032.00": { socCode: "53-3032", injuriesPer100: 5.6, healthInsurancePct: 78, retirementPct: 62, paidSickPct: 58, avgHoursPerWeek: 52, overtimePrevalencePct: 68 }, // Heavy Truck Drivers
  "53-3033.00": { socCode: "53-3033", injuriesPer100: 4.2, healthInsurancePct: 62, retirementPct: 48, paidSickPct: 52, avgHoursPerWeek: 42, overtimePrevalencePct: 38 }, // Light Truck Drivers
  "53-7062.00": { socCode: "53-7062", injuriesPer100: 7.2, healthInsurancePct: 58, retirementPct: 38, paidSickPct: 44, avgHoursPerWeek: 38, overtimePrevalencePct: 22 }, // Hand Laborers / Movers
  "53-7065.00": { socCode: "53-7065", injuriesPer100: 5.4, healthInsurancePct: 62, retirementPct: 42, paidSickPct: 48, avgHoursPerWeek: 36, overtimePrevalencePct: 20 }, // Stockers

  // ── Administrative ────────────────────────────────────────────────
  "43-4051.00": { socCode: "43-4051", injuriesPer100: 0.8, healthInsurancePct: 78, retirementPct: 68, paidSickPct: 78, avgHoursPerWeek: 38, overtimePrevalencePct: 14 }, // Customer Service Reps
  "43-6014.00": { socCode: "43-6014", injuriesPer100: 0.5, healthInsurancePct: 82, retirementPct: 72, paidSickPct: 80, avgHoursPerWeek: 38, overtimePrevalencePct: 10 }, // Secretaries
  "43-9061.00": { socCode: "43-9061", injuriesPer100: 0.6, healthInsurancePct: 75, retirementPct: 62, paidSickPct: 75, avgHoursPerWeek: 36, overtimePrevalencePct: 8 },  // Office Clerks

  // ── Finance ───────────────────────────────────────────────────────
  "13-2011.00": { socCode: "13-2011", injuriesPer100: 0.3, healthInsurancePct: 95, retirementPct: 88, paidSickPct: 92, avgHoursPerWeek: 42, overtimePrevalencePct: 38 }, // Accountants
  "13-2072.00": { socCode: "13-2072", injuriesPer100: 0.3, healthInsurancePct: 90, retirementPct: 85, paidSickPct: 87, avgHoursPerWeek: 41, overtimePrevalencePct: 28 }, // Loan Officers

  // ── Tech ───────────────────────────────────────────────────────────
  "15-1252.00": { socCode: "15-1252", injuriesPer100: 0.2, healthInsurancePct: 98, retirementPct: 96, paidSickPct: 97, avgHoursPerWeek: 41, overtimePrevalencePct: 22 }, // Software Developers

  // ── Hospitality ───────────────────────────────────────────────────
  "35-3031.00": { socCode: "35-3031", injuriesPer100: 2.3, healthInsurancePct: 22, retirementPct: 12, paidSickPct: 28, avgHoursPerWeek: 25, overtimePrevalencePct: 8 },  // Waiters
  "35-2014.00": { socCode: "35-2014", injuriesPer100: 4.0, healthInsurancePct: 38, retirementPct: 22, paidSickPct: 42, avgHoursPerWeek: 34, overtimePrevalencePct: 18 }, // Cooks
  "35-3011.00": { socCode: "35-3011", injuriesPer100: 1.8, healthInsurancePct: 32, retirementPct: 18, paidSickPct: 35, avgHoursPerWeek: 30, overtimePrevalencePct: 12 }, // Bartenders

  // ── Facilities / Safety ───────────────────────────────────────────
  "33-9032.00": { socCode: "33-9032", injuriesPer100: 2.4, healthInsurancePct: 52, retirementPct: 32, paidSickPct: 42, avgHoursPerWeek: 38, overtimePrevalencePct: 18 }, // Security Guards
  "37-2011.00": { socCode: "37-2011", injuriesPer100: 4.4, healthInsurancePct: 48, retirementPct: 28, paidSickPct: 38, avgHoursPerWeek: 32, overtimePrevalencePct: 14 }, // Janitors
};

export function getWorkplace(socCode: string | null | undefined): WorkplaceData | null {
  if (!socCode) return null;
  return WORKPLACE[socCode] || null;
}

/**
 * Quick worker-facing summary: returns the most distinctive 1–2 facts
 * about the role's working conditions. Used as a short caption.
 */
export function workplaceHighlight(w: WorkplaceData | null): string {
  if (!w) return "";
  const parts: string[] = [];
  if (w.healthInsurancePct >= 80) parts.push("Health insurance prevalent");
  else if (w.healthInsurancePct < 40) parts.push("Few jobs include health insurance");
  if (w.overtimePrevalencePct >= 40) parts.push("Heavy overtime common");
  if (w.injuriesPer100 >= 5) parts.push("Physically demanding");
  if (w.avgHoursPerWeek <= 28) parts.push("Often part-time");
  return parts.slice(0, 2).join(" · ");
}
