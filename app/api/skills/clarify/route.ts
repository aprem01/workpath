import { NextResponse } from "next/server";
import {
  needsIndustryClarification,
  verticalToIndustry,
} from "@/lib/taxonomy";
import { getDomainById } from "@/lib/domains";

export const dynamic = "force-dynamic";

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
    const candidates = needsIndustryClarification(skill.trim(), anchor);
    return NextResponse.json({ candidates });
  } catch {
    return NextResponse.json({ candidates: null });
  }
}
