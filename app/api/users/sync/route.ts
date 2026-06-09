import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * POST /api/users/sync
 *
 * Persists a PayRanker user + their skill basket to the shared Neon DB
 * so Skilmatch can query them as real candidates. Until this route
 * existed, the entire PayRanker app was client-side-localStorage only,
 * which meant Skilmatch's /api/employer/candidates always fell back to
 * mock data — even though both apps share the same Postgres.
 *
 * Called from:
 *  - /skills page (debounced on basket change)
 *  - /profile page on completion
 *
 * Body:
 *  {
 *    anonymousHandle: string,         // required — primary key for the user
 *    zipCode?: string,
 *    profileComplete?: boolean,
 *    skills: Array<{
 *      rawInput: string,
 *      normalizedTerm: string,
 *      category?: string,
 *      proficiencyLevel?: string,
 *      context?: string,              // industry context picked by clarifier
 *      isAISuggested?: boolean,
 *    }>
 *  }
 *
 * Returns: { ok: true, userId, skillCount }
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { anonymousHandle, zipCode, profileComplete, skills } = body;

    if (
      typeof anonymousHandle !== "string" ||
      anonymousHandle.length < 3 ||
      anonymousHandle.length > 64
    ) {
      return NextResponse.json(
        { error: "anonymousHandle required (3-64 chars)" },
        { status: 400 }
      );
    }
    if (!Array.isArray(skills)) {
      return NextResponse.json(
        { error: "skills array required (can be empty)" },
        { status: 400 }
      );
    }

    // Upsert the User row by anonymousHandle. We never collect email or
    // PII here — the anonymousHandle is the only identifier Skilmatch
    // ever sees on the candidates list.
    const user = await prisma.user.upsert({
      where: { anonymousHandle },
      create: {
        anonymousHandle,
        zipCode: zipCode || null,
        profileComplete: !!profileComplete,
      },
      update: {
        zipCode: zipCode || undefined,
        profileComplete: profileComplete ?? undefined,
      },
      select: { id: true },
    });

    // Replace the user's UserSkill rows in one transaction. Cheap because
    // baskets are small (typical: 5-25 skills) and indexed.
    await prisma.$transaction([
      prisma.userSkill.deleteMany({ where: { userId: user.id } }),
      prisma.userSkill.createMany({
        data: skills.map(
          (s: {
            rawInput?: string;
            normalizedTerm: string;
            category?: string;
            proficiencyLevel?: string;
            context?: string;
            isAISuggested?: boolean;
          }) => ({
            userId: user.id,
            rawInput: s.rawInput || s.normalizedTerm,
            // If the clarifier attached an industry context, embed it
            // into the normalizedTerm so cluster matching sees it.
            // Skilmatch's candidates query uses normalizedTerm directly.
            normalizedTerm: s.context
              ? `${s.normalizedTerm} (${s.context})`
              : s.normalizedTerm,
            category: s.category || "other",
            proficiencyLevel: s.proficiencyLevel || "intermediate",
            isAISuggested: !!s.isAISuggested,
          })
        ),
      }),
    ]);

    return NextResponse.json({
      ok: true,
      userId: user.id,
      skillCount: skills.length,
    });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : "unknown";
    console.error("user sync error:", errMsg);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
