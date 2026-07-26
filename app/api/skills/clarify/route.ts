import { NextResponse } from "next/server";
import {
  needsIndustryClarification,
  verticalToIndustry,
} from "@/lib/taxonomy";
import { getDomainById } from "@/lib/domains";

export const dynamic = "force-dynamic";

// Caroline 7/18 Round 5 P4: some skill labels are colloquially so
// common that they NEVER map cleanly to a single O*NET industry, yet
// the taxonomy sometimes ships them as single-industry entries.
// "Management inside Logistics" is a wholly different job than
// "Management inside Healthcare" — force the picker for these.
const FORCE_AMBIGUOUS: Record<string, string[]> = {
  management: [
    "Retail",
    "Food Service",
    "Healthcare",
    "Trades",
    "Logistics",
    "Administrative",
  ],
  "customer service": ["Retail", "Food Service", "Healthcare", "Administrative"],
  supervisor: ["Retail", "Food Service", "Healthcare", "Trades", "Logistics"],
  scheduling: ["Healthcare", "Administrative", "Logistics"],
  inventory: ["Retail", "Warehouse", "Food Service"],
  training: ["Healthcare", "Trades", "Retail", "Administrative"],
};

/**
 * POST /api/skills/clarify
 *
 * Server-side wrapper around `needsIndustryClarification()` so the
 * 900KB+ O*NET taxonomy doesn't ship to the browser. Called by the
 * /skills page when the user submits a skill — if the skill lives in
 * 2+ industries and the user's domain anchor (if any) doesn't
 * disambiguate it, we return the candidate industries for the chip
 * picker.
 *
 * Body: { skill: string, domainId?: string }
 * Returns: { candidates: string[] | null }
 */
export async function POST(req: Request) {
  try {
    const { skill, domainId } = await req.json();
    if (typeof skill !== "string" || !skill.trim()) {
      return NextResponse.json({ candidates: null });
    }
    const anchor = verticalToIndustry(
      getDomainById(domainId)?.vertical || null
    );
    const trimmed = skill.trim();
    const forced = FORCE_AMBIGUOUS[trimmed.toLowerCase()];
    if (forced && !(anchor && forced.includes(anchor))) {
      return NextResponse.json({ candidates: forced });
    }
    const candidates = needsIndustryClarification(trimmed, anchor);
    return NextResponse.json({ candidates });
  } catch {
    return NextResponse.json({ candidates: null });
  }
}
