import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const client = new Anthropic();

// ─── Stage 1: Graph lookup ─────────────────────────────────────────
// Check aliases, find parent→children, siblings, same-vertical nodes.
// This is instant (DB) and gives structured, consistent results.
async function graphLookup(rawSkill: string, existingSkills: string[]) {
  const term = rawSkill.toLowerCase().trim();
  const existingSet = new Set(existingSkills.map((s) => s.toLowerCase()));

  // Check alias table
  const alias = await prisma.skillAlias.findUnique({
    where: { rawTerm: term },
    include: {
      skillNode: {
        include: {
          children: true,
          parent: { include: { children: true } },
        },
      },
    },
  });

  if (!alias) {
    // Also try matching canonical term directly
    const directNode = await prisma.skillNode.findUnique({
      where: { canonicalTerm: rawSkill.trim() },
      include: {
        children: true,
        parent: { include: { children: true } },
      },
    });
    if (!directNode) return null;
    return buildGraphResponse(directNode, existingSet);
  }

  return buildGraphResponse(alias.skillNode, existingSet);
}

function buildGraphResponse(
  node: {
    canonicalTerm: string;
    vertical: string | null;
    layer: string;
    aiResistanceScore: number;
    children: { canonicalTerm: string; aiResistanceScore: number; layer: string }[];
    parent: { children: { canonicalTerm: string; aiResistanceScore: number }[] } | null;
  },
  existingSet: Set<string>
) {
  const related: string[] = [];
  const childSkills: string[] = [];
  const microSkills: string[] = [];

  // Children → if parent skill, these are the structured sub-skills
  for (const child of node.children) {
    if (!existingSet.has(child.canonicalTerm.toLowerCase())) {
      if (child.layer === "micro") {
        microSkills.push(child.canonicalTerm);
      } else {
        childSkills.push(child.canonicalTerm);
      }
    }
  }

  // Siblings (other children of same parent)
  if (node.parent) {
    for (const sibling of node.parent.children) {
      if (
        sibling.canonicalTerm !== node.canonicalTerm &&
        !existingSet.has(sibling.canonicalTerm.toLowerCase())
      ) {
        related.push(sibling.canonicalTerm);
      }
    }
  }

  return {
    normalizedTerm: node.canonicalTerm,
    category: node.vertical || "other",
    layer: node.layer,
    isRecognized: true,
    aiResistanceScore: node.aiResistanceScore,
    childSkills,
    microSkills,
    aiSuggestions: [...childSkills, ...microSkills, ...related],
    note: "",
    source: "graph",
  };
}

// ─── Stage 2: AI taxonomy expansion ────────────────────────────────
// For skills NOT in the graph, Claude generates the full 3-layer response.
// This is the "intelligence" layer — it understands any vertical, any skill.
async function aiTaxonomyExpansion(
  rawSkill: string,
  existingSkills: string[]
) {
  const message = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1000,
    messages: [
      {
        role: "user",
        content: `You are a world-class labor market taxonomy engine. You build structured skill graphs that help job seekers and employers match with precision.

A job seeker typed: "${rawSkill}"
Their current skill basket: ${existingSkills.join(", ") || "empty"}

You must return a 3-layer skill taxonomy response. This is what makes us an intelligence platform, not a job board.

Return ONLY valid JSON (no markdown, no explanation):
{
  "normalizedTerm": "the canonical professional term for this skill",
  "category": "healthcare | trades | tech | admin | food_service | transport | education | retail | finance | legal | creative | engineering | management | other",
  "layer": "canonical | parent | micro",
  "isRecognized": true,
  "aiResistanceScore": 0-100,
  "childSkills": ["if this is a PARENT/BROAD skill, list 4-6 specific sub-skills that break it down into concrete capabilities"],
  "microSkills": ["if this is a SPECIFIC skill, list 3-5 proficiency-level variants like 'Python: Data Analysis', 'CPR: Pediatric'"],
  "aiSuggestions": ["8-15 related skills — mix of: skills they probably already have, skills that unlock higher pay, and AI-proof skills. Consider ALL skills in their basket for context"],
  "payImpact": "one sentence on how this skill affects pay in the relevant vertical",
  "aiRiskNote": "one sentence on whether AI threatens or enhances this skill",
  "note": ""
}

RULES — read carefully:
1. ALIASES: If the input is colloquial ("cooking", "helping old people"), normalize to the professional term
2. PARENT→CHILD: If the input is broad ("Caregiving", "Programming", "Project Management"), set layer="parent" and populate childSkills with 4-6 concrete sub-skills
3. MICRO-SKILLS: If the input is specific ("Python", "CPR", "Excel"), populate microSkills with proficiency variants so employers can evaluate depth (e.g. "Python: Scripting", "Python: Data Analysis", "Python: ML/AI", "Python: Web Development")
4. aiResistanceScore: Physical hands-on care=85-95, emotional/interpersonal=80-90, creative/strategic=70-80, routine cognitive=40-60, data entry/admin=20-40
5. aiSuggestions must be contextual — use the FULL basket to suggest complementary skills, not generic ones
6. Never repeat skills already in the basket
7. This works for ALL verticals: healthcare, tech, trades, finance, law, creative, executive — not just HHA`,
      },
    ],
  });

  const text = (message.content[0] as { type: string; text: string }).text;
  return JSON.parse(text);
}

// ─── Stage 3: Graph enrichment ─────────────────────────────────────
// After AI responds, also pull related skills from the DB graph to supplement
async function enrichWithGraph(
  normalizedTerm: string,
  existingSkills: string[],
  currentSuggestions: string[]
): Promise<string[]> {
  const existingSet = new Set([
    ...existingSkills.map((s) => s.toLowerCase()),
    ...currentSuggestions.map((s) => s.toLowerCase()),
    normalizedTerm.toLowerCase(),
  ]);

  const sameVertical = await prisma.skillNode.findMany({
    where: {
      layer: "canonical",
      canonicalTerm: { not: { in: Array.from(existingSet) } },
    },
    take: 8,
    orderBy: { aiResistanceScore: "desc" },
  });

  return sameVertical
    .filter((s) => !existingSet.has(s.canonicalTerm.toLowerCase()))
    .map((s) => s.canonicalTerm);
}

// ─── Main handler ──────────────────────────────────────────────────
export async function POST(req: Request) {
  let rawSkill = "";
  try {
    const body = await req.json();
    rawSkill = body.rawSkill;
    const existingSkills: string[] = body.existingSkills || [];

    if (!rawSkill || typeof rawSkill !== "string") {
      return NextResponse.json(
        { error: "rawSkill is required" },
        { status: 400 }
      );
    }

    // Stage 1: Try graph lookup (instant, structured)
    const graphResult = await graphLookup(rawSkill, existingSkills);

    if (graphResult) {
      // Enrich with more graph suggestions
      const extra = await enrichWithGraph(
        graphResult.normalizedTerm,
        existingSkills,
        graphResult.aiSuggestions
      );
      graphResult.aiSuggestions = [...graphResult.aiSuggestions, ...extra];

      // Track analytics
      try {
        await prisma.analyticsEvent.create({
          data: {
            event: "skill_added",
            metadata: JSON.stringify({
              rawSkill,
              normalized: graphResult.normalizedTerm,
              source: "graph",
              layer: graphResult.layer,
            }),
          },
        });
      } catch {}

      return NextResponse.json(graphResult);
    }

    // Stage 2: AI taxonomy expansion (smart, handles any vertical)
    const aiResult = await aiTaxonomyExpansion(rawSkill, existingSkills);
    aiResult.source = "ai";

    // Stage 3: Enrich AI result with graph data
    const extra = await enrichWithGraph(
      aiResult.normalizedTerm,
      existingSkills,
      [...(aiResult.aiSuggestions || []), ...(aiResult.childSkills || []), ...(aiResult.microSkills || [])]
    );

    // Merge: AI suggestions + child skills + micro skills + graph enrichment
    const allSuggestions = [
      ...(aiResult.childSkills || []),
      ...(aiResult.microSkills || []),
      ...(aiResult.aiSuggestions || []),
      ...extra,
    ];

    // Dedupe
    const seen = new Set<string>();
    aiResult.aiSuggestions = allSuggestions.filter((s: string) => {
      const lower = s.toLowerCase();
      if (seen.has(lower) || existingSkills.some((e) => e.toLowerCase() === lower)) return false;
      seen.add(lower);
      return true;
    });

    // Track analytics
    try {
      await prisma.analyticsEvent.create({
        data: {
          event: "skill_added",
          metadata: JSON.stringify({
            rawSkill,
            normalized: aiResult.normalizedTerm,
            source: "ai",
            layer: aiResult.layer,
          }),
        },
      });
    } catch {}

    return NextResponse.json(aiResult);
  } catch (error) {
    console.error("Skill normalization error:", error);
    return NextResponse.json({
      normalizedTerm: rawSkill || "unknown skill",
      category: "other",
      layer: "canonical",
      isRecognized: false,
      aiResistanceScore: 50,
      childSkills: [],
      microSkills: [],
      aiSuggestions: [],
      note: "",
      source: "fallback",
    });
  }
}
