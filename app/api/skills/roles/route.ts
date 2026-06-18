import { NextResponse } from "next/server";
import { TAXONOMY } from "@/lib/taxonomy";
import { expandWithSynonyms } from "@/lib/equivalencies";

export const dynamic = "force-dynamic";

/**
 * GET /api/skills/roles?skill=Vital+Signs+Monitoring
 *
 * Phase 3: powers the /skills/explore "this unlocks N roles" line.
 * Returns the TAXONOMY roles that require (or list) this skill, so
 * we can show "Add Vital Signs Monitoring — required for 23 roles
 * including: Home Health Aide, CNA, Medical Assistant."
 *
 * Synonyms expanded — adding "Bandaging" finds roles that require
 * "Apply bandages, dressings, or splints" (its canonical form).
 *
 * Returns:
 *   { count: number, roles: [{ role, industry, socCode }] }  (top 8)
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const skill = (url.searchParams.get("skill") || "").trim();
  if (!skill) return NextResponse.json({ count: 0, roles: [] });

  const variants = new Set(
    expandWithSynonyms(skill).map((s) => s.toLowerCase())
  );

  const matches: { role: string; industry: string; socCode?: string }[] = [];
  for (const entry of TAXONOMY) {
    for (const s of entry.skills) {
      if (variants.has(s.toLowerCase())) {
        matches.push({
          role: entry.role,
          industry: entry.industry,
          socCode: entry.socCode,
        });
        break;
      }
    }
  }

  return NextResponse.json({
    count: matches.length,
    roles: matches.slice(0, 8),
  });
}
