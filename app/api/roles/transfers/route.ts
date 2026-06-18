import { NextResponse } from "next/server";
import { TAXONOMY } from "@/lib/taxonomy";
import { TRANSFERABILITY } from "@/lib/transferability";

export const dynamic = "force-dynamic";

interface BySoc {
  [soc: string]: (typeof TAXONOMY)[number];
}
const ROLE_BY_SOC: BySoc = (() => {
  const m: BySoc = {};
  for (const e of TAXONOMY) {
    if (e.socCode) m[e.socCode] = e;
  }
  return m;
})();

/**
 * POST /api/roles/transfers
 *
 * Phase 2 of Caroline's taxonomy ladder. Given a worker's skill basket,
 * returns:
 *  - their nearest matched role (by skill overlap)
 *  - the top N "adjacent" roles they can transfer to, with the
 *    transferability score and the specific skills they share + lack.
 *
 * Powers the /matches reveal panel + future "What's adjacent" UI:
 *   "You're closest to Solar Photovoltaic Installer (65% match).
 *    Adjacent roles: Elevator Installer (26% transferable, share 8 skills,
 *    need 3 more), Plumber (21%, share 7, need 4 more)."
 *
 * Body: { skills: string[], topN?: number }
 * Returns: {
 *   nearestRole: { socCode, role, industry, matchPercent, sharedSkillCount },
 *   transfers: [{ socCode, role, industry, score, sharedSkillCount, needToLearn[] }]
 * }
 */
export async function POST(req: Request) {
  try {
    const { skills, topN } = await req.json();
    if (!Array.isArray(skills) || skills.length === 0) {
      return NextResponse.json({ nearestRole: null, transfers: [] });
    }

    const userSkills = new Set<string>(
      skills.map((s: string) => s.toLowerCase().trim()).filter(Boolean)
    );

    // ── Nearest role by Jaccard over the worker's basket vs each role's
    // skill set. The role with the highest score is the worker's
    // "anchor role" — adjacency starts from there.
    let nearest: {
      entry: (typeof TAXONOMY)[number];
      score: number;
      shared: number;
    } | null = null;
    for (const entry of TAXONOMY) {
      if (!entry.socCode) continue;
      let shared = 0;
      const roleSet = new Set(entry.skills.map((s) => s.toLowerCase()));
      userSkills.forEach((s) => {
        if (roleSet.has(s)) shared++;
      });
      if (shared === 0) continue;
      const union = roleSet.size + userSkills.size - shared;
      const score = shared / union;
      if (!nearest || score > nearest.score) {
        nearest = { entry, score, shared };
      }
    }

    if (!nearest) {
      return NextResponse.json({ nearestRole: null, transfers: [] });
    }

    // ── Top-N transfers from that nearest role.
    const max = Math.min(typeof topN === "number" ? topN : 8, 15);
    const edges = TRANSFERABILITY[nearest.entry.socCode!] || [];

    const transfers = edges.slice(0, max).map((edge) => {
      const target = ROLE_BY_SOC[edge.toSoc];
      if (!target) return null;
      const userLower = userSkills;
      const targetLower = target.skills.map((s) => s.toLowerCase());
      const needToLearn = target.skills.filter(
        (_, i) => !userLower.has(targetLower[i])
      );
      return {
        socCode: edge.toSoc,
        role: target.role,
        industry: target.industry,
        score: edge.score,
        sharedSkillCount: edge.sharedSkillCount,
        needToLearn: needToLearn.slice(0, 5),
        credentials: target.credentials,
      };
    }).filter(Boolean);

    return NextResponse.json({
      nearestRole: {
        socCode: nearest.entry.socCode,
        role: nearest.entry.role,
        industry: nearest.entry.industry,
        matchPercent: Math.round(nearest.score * 100),
        sharedSkillCount: nearest.shared,
      },
      transfers,
    });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : "unknown";
    console.error("transfers error:", errMsg);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
