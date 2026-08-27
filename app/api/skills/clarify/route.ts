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
  // Caroline 8/23 Round 8 landing spec: colloquial single-word skills
  // must funnel into industry-specific structured variants rather than
  // silently locking into a single vertical.
  cooking: ["Food Service", "Healthcare Support", "Food Manufacturing"],
  sales: ["Retail", "Luxury Sales", "Administrative Sales", "B2B Sales", "Technical Sales"],
  cleaning: ["Healthcare Support", "Hospitality", "Facilities"],
  driving: ["Delivery", "Rideshare", "Logistics", "Healthcare Transport"],
  teaching: ["K-12", "Higher Education", "Corporate Training", "Early Childhood"],
  writing: ["Marketing", "Journalism", "Technical Writing", "Copywriting"],
  design: ["Graphic Design", "Interior Design", "UX/UI", "Industrial Design"],
  security: ["Physical Security", "Cybersecurity", "Loss Prevention"],
  administration: ["Healthcare", "Legal", "Corporate", "Education"],
  marketing: ["Digital", "Retail", "B2B", "Content"],
};

// Caroline 7/28 Round 7: "Bilingual" and "Trilingual" describe the
// worker but aren't skills employers search on — the actual LANGUAGE
// is what matches jobs. Force a language picker for these labels.
const FORCE_LANGUAGE_PICKER: Record<string, string[]> = {
  bilingual: ["Spanish", "Chinese (Mandarin)", "French", "Vietnamese", "Arabic", "Polish", "Russian", "Tagalog"],
  trilingual: ["Spanish", "Chinese (Mandarin)", "French", "Vietnamese", "Arabic", "Polish", "Russian", "Tagalog"],
  multilingual: ["Spanish", "Chinese (Mandarin)", "French", "Vietnamese", "Arabic", "Polish", "Russian", "Tagalog"],
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
    const lower = trimmed.toLowerCase();
    // Language picker takes precedence — Bilingual/Trilingual/Multilingual
    // aren't industries, they're a language-question funnel. Front-end
    // treats `kind: "language"` the same as industry chips today but
    // stores the picked LANGUAGE as the skill, not the umbrella term.
    const langOpts = FORCE_LANGUAGE_PICKER[lower];
    if (langOpts) {
      return NextResponse.json({ candidates: langOpts, kind: "language" });
    }
    const forced = FORCE_AMBIGUOUS[lower];
    if (forced && !(anchor && forced.includes(anchor))) {
      return NextResponse.json({ candidates: forced });
    }
    const candidates = needsIndustryClarification(trimmed, anchor);
    return NextResponse.json({ candidates });
  } catch {
    return NextResponse.json({ candidates: null });
  }
}
