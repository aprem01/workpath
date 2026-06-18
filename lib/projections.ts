/**
 * BLS Employment Projections 2024-2034 — Phase 4 (more data layer).
 *
 * Each entry: projected percent change in employment between the
 * baseline year (2024) and target year (2034). Sourced from BLS
 * Employment Projections, October 2025 release.
 *
 * Powerful signal for the worker: "Solar Photovoltaic Installer is
 * projected to grow +48% over the next decade" gives a tangible
 * future-looking signal alongside the AI-resistance score.
 *
 * Seeded coverage: top 30 SOCs (same set as lib/wages.ts). Complete
 * coverage requires running scripts/ingest-bls-projections.ts with
 * a BLS API key.
 */

export interface Projection {
  socCode: string;
  /** Percent change in employment 2024-2034. Positive = growth. */
  growthPct: number;
  baselineYear: 2024;
  targetYear: 2034;
}

export const PROJECTIONS: Record<string, Projection> = {
  // ── High-growth (AI-proof, demographic-driven) ────────────────────
  "31-1121.00": { socCode: "31-1121", growthPct: 21, baselineYear: 2024, targetYear: 2034 }, // HHA — caregiving for aging boomers
  "29-1071.00": { socCode: "29-1071", growthPct: 46, baselineYear: 2024, targetYear: 2034 }, // Nurse Practitioners
  "47-2231.00": { socCode: "47-2231", growthPct: 48, baselineYear: 2024, targetYear: 2034 }, // Solar Installers
  "31-9011.00": { socCode: "31-9011", growthPct: 18, baselineYear: 2024, targetYear: 2034 }, // Massage Therapists
  "29-1122.00": { socCode: "29-1122", growthPct: 11, baselineYear: 2024, targetYear: 2034 }, // OT
  "29-1123.00": { socCode: "29-1123", growthPct: 14, baselineYear: 2024, targetYear: 2034 }, // PT
  "29-1141.00": { socCode: "29-1141", growthPct: 6,  baselineYear: 2024, targetYear: 2034 }, // RN
  "29-2061.00": { socCode: "29-2061", growthPct: 3,  baselineYear: 2024, targetYear: 2034 }, // LPN
  "31-1131.00": { socCode: "31-1131", growthPct: 5,  baselineYear: 2024, targetYear: 2034 }, // CNA
  "31-9092.00": { socCode: "31-9092", growthPct: 15, baselineYear: 2024, targetYear: 2034 }, // Medical Assistants

  // ── Steady (trades — hard to automate) ────────────────────────────
  "47-2111.00": { socCode: "47-2111", growthPct: 11, baselineYear: 2024, targetYear: 2034 }, // Electricians
  "47-2152.00": { socCode: "47-2152", growthPct: 8,  baselineYear: 2024, targetYear: 2034 }, // Plumbers
  "47-2031.00": { socCode: "47-2031", growthPct: 3,  baselineYear: 2024, targetYear: 2034 }, // Carpenters
  "47-2061.00": { socCode: "47-2061", growthPct: 5,  baselineYear: 2024, targetYear: 2034 }, // Construction Laborers

  // ── Logistics ─────────────────────────────────────────────────────
  "53-3032.00": { socCode: "53-3032", growthPct: 1,  baselineYear: 2024, targetYear: 2034 }, // Heavy Truck Drivers
  "53-3033.00": { socCode: "53-3033", growthPct: 5,  baselineYear: 2024, targetYear: 2034 }, // Light Truck Drivers
  "53-7062.00": { socCode: "53-7062", growthPct: 3,  baselineYear: 2024, targetYear: 2034 }, // Hand Laborers/Movers
  "53-7065.00": { socCode: "53-7065", growthPct: 4,  baselineYear: 2024, targetYear: 2034 }, // Stockers

  // ── Tech ───────────────────────────────────────────────────────────
  "15-1252.00": { socCode: "15-1252", growthPct: 18, baselineYear: 2024, targetYear: 2034 }, // Software Developers

  // ── Sales / Retail (declining — Amazon effect) ────────────────────
  "41-2031.00": { socCode: "41-2031", growthPct: -1, baselineYear: 2024, targetYear: 2034 }, // Retail Sales
  "41-1011.00": { socCode: "41-1011", growthPct: 0,  baselineYear: 2024, targetYear: 2034 }, // Retail Supervisors
  "41-2011.00": { socCode: "41-2011", growthPct: -8, baselineYear: 2024, targetYear: 2034 }, // Cashiers

  // ── Admin (declining — AI-assist effect) ──────────────────────────
  "43-4051.00": { socCode: "43-4051", growthPct: -5, baselineYear: 2024, targetYear: 2034 }, // Customer Service Reps
  "43-6014.00": { socCode: "43-6014", growthPct: -10, baselineYear: 2024, targetYear: 2034 }, // Secretaries
  "43-9061.00": { socCode: "43-9061", growthPct: -4, baselineYear: 2024, targetYear: 2034 }, // Office Clerks

  // ── Finance ───────────────────────────────────────────────────────
  "13-2011.00": { socCode: "13-2011", growthPct: 6,  baselineYear: 2024, targetYear: 2034 }, // Accountants
  "13-2072.00": { socCode: "13-2072", growthPct: 3,  baselineYear: 2024, targetYear: 2034 }, // Loan Officers

  // ── Hospitality ───────────────────────────────────────────────────
  "35-3031.00": { socCode: "35-3031", growthPct: 5,  baselineYear: 2024, targetYear: 2034 }, // Waiters
  "35-2014.00": { socCode: "35-2014", growthPct: 9,  baselineYear: 2024, targetYear: 2034 }, // Cooks
  "35-3011.00": { socCode: "35-3011", growthPct: 3,  baselineYear: 2024, targetYear: 2034 }, // Bartenders

  // ── Facilities / Safety ───────────────────────────────────────────
  "33-9032.00": { socCode: "33-9032", growthPct: 2,  baselineYear: 2024, targetYear: 2034 }, // Security Guards
  "37-2011.00": { socCode: "37-2011", growthPct: 4,  baselineYear: 2024, targetYear: 2034 }, // Janitors
};

export function getProjection(socCode: string | null | undefined): Projection | null {
  if (!socCode) return null;
  return PROJECTIONS[socCode] || null;
}

/**
 * Returns a short text label for the worker UI.
 * +18% → "growing fast"
 * +5% → "growing"
 * 0%  → "steady"
 * -5% → "declining"
 * -15% → "shrinking fast"
 */
export function projectionLabel(p: Projection | null): string {
  if (!p) return "";
  if (p.growthPct >= 15) return "growing fast";
  if (p.growthPct >= 4)  return "growing";
  if (p.growthPct >= -3) return "steady";
  if (p.growthPct >= -10) return "declining";
  return "shrinking fast";
}

/**
 * Returns a color hint for the UI: "green" | "amber" | "magenta" | "red"
 * (callers map to brand tokens).
 */
export function projectionColor(p: Projection | null): "green" | "amber" | "magenta" | "red" | "" {
  if (!p) return "";
  if (p.growthPct >= 15) return "green";
  if (p.growthPct >= 4)  return "magenta";
  if (p.growthPct >= -3) return "amber";
  return "red";
}
