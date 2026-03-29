import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  findSkillNode,
  getChildren,
  getSiblings,
  getRelatedWithinHops,
  getAIProofSkills,
} from "@/lib/neo4j";

export const dynamic = "force-dynamic";

const client = new Anthropic();

// ─── Stage 1: Neo4j Graph Lookup (instant) ─────────────────────────
// Graph DB gives us: aliases, parent→child, siblings, 2-hop related
async function graphLookup(rawSkill: string, existingSkills: string[]) {
  const existingSet = new Set(existingSkills.map((s) => s.toLowerCase()));

  // Find the node (checks aliases + direct canonical match)
  const node = await findSkillNode(rawSkill);
  if (!node) return null;

  existingSet.add(node.term.toLowerCase());

  // Get children (parent→canonical or canonical→micro)
  const children = await getChildren(node.term);
  const childSkills = children
    .filter((c) => c.layer !== "micro" && !existingSet.has(c.term.toLowerCase()))
    .map((c) => c.term);
  const microSkills = children
    .filter((c) => c.layer === "micro" && !existingSet.has(c.term.toLowerCase()))
    .map((c) => c.term);

  // Get siblings
  const siblings = await getSiblings(node.term);
  const siblingTerms = siblings
    .filter((s) => !existingSet.has(s.term.toLowerCase()))
    .map((s) => s.term);

  // GRAPH POWER: 2-hop traversal — finds skills that are 1-2 relationships away
  const related = await getRelatedWithinHops(node.term, 2, 15);
  const relatedTerms = related
    .filter((r) => !existingSet.has(r.term.toLowerCase()))
    .map((r) => r.term);

  // AI-proof recommendations from the graph
  const aiProof = await getAIProofSkills(
    [...existingSkills, node.term],
    5
  );
  const aiProofTerms = aiProof.map((s) => s.term);

  // Merge all suggestions (dedupe)
  const seen = new Set<string>();
  const allSuggestions: string[] = [];
  for (const list of [childSkills, microSkills, siblingTerms, relatedTerms, aiProofTerms]) {
    for (const term of list) {
      const lower = term.toLowerCase();
      if (!seen.has(lower) && !existingSet.has(lower)) {
        seen.add(lower);
        allSuggestions.push(term);
      }
    }
  }

  return {
    normalizedTerm: node.term,
    category: node.vertical || "other",
    layer: node.layer,
    isRecognized: true,
    aiResistanceScore: node.aiResistance,
    childSkills,
    microSkills,
    aiSuggestions: allSuggestions,
    note: "",
    source: "neo4j_graph",
  };
}

// ─── Stage 2: AI Taxonomy Expansion ────────────────────────────────
// Claude generates full 3-layer response for ANY skill in ANY vertical.
// Inspired by Karpathy's jobs project: LLM scoring for AI exposure.
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
        content: `You are a world-class labor market taxonomy engine that builds structured skill graphs.
You understand Bureau of Labor Statistics occupation data, O*NET skill classifications, and AI automation research.

A job seeker typed: "${rawSkill}"
Their current skill basket: ${existingSkills.join(", ") || "empty"}

Return ONLY valid JSON:
{
  "normalizedTerm": "canonical professional term (use BLS/O*NET terminology when possible)",
  "category": "healthcare | trades | tech | admin | food_service | transport | education | retail | finance | legal | creative | engineering | management | other",
  "layer": "canonical | parent | micro",
  "isRecognized": true,
  "aiResistanceScore": 0-100,
  "childSkills": ["if PARENT/BROAD: 4-6 specific sub-skills"],
  "microSkills": ["if SPECIFIC: 3-5 proficiency variants (e.g. 'Python: Data Analysis')"],
  "aiSuggestions": ["10-15 related skills — prioritize: (1) AI-proof skills first, (2) skills that bridge to higher-paying roles, (3) complementary skills based on full basket"],
  "payImpact": "one sentence: how this skill affects pay (use BLS data patterns)",
  "aiRiskNote": "one sentence: AI automation risk level and what to do about it",
  "blsOccupations": ["1-3 BLS occupation titles this skill maps to"],
  "note": ""
}

SCORING RULES (inspired by labor economics research):
- aiResistanceScore: Physical dexterity + human judgment = 85-95, Creative/strategic = 70-85, Routine cognitive = 40-60, Data entry/processing = 15-35
- Skills requiring empathy, physical presence, trust-building, or novel problem-solving are most AI-resistant
- Skills that are purely information processing, pattern matching, or rule-following are most at risk
- The BEST career advice: combine a domain skill with an AI-complementary skill (e.g. "Nursing + Data Literacy")

SUGGESTION RULES:
- First 3 suggestions should be AI-PROOF skills (aiResistance > 75)
- Next 3 should be CAREER-BRIDGING skills (unlock higher-paying roles)
- Remaining should be BASKET-COMPLEMENTARY (co-occur with existing skills)
- Never repeat skills already in the basket`,
      },
    ],
  });

  const text = (message.content[0] as { type: string; text: string }).text;
  return JSON.parse(text);
}

// ─── Stage 3: Graph Enrichment ─────────────────────────────────────
async function enrichFromGraph(
  normalizedTerm: string,
  existingSkills: string[],
  currentSuggestions: string[]
): Promise<string[]> {
  try {
    const aiProof = await getAIProofSkills(
      [...existingSkills, normalizedTerm, ...currentSuggestions],
      5
    );
    return aiProof.map((s) => s.term);
  } catch {
    return [];
  }
}

// ─── Main Handler ──────────────────────────────────────────────────
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

    // Stage 1: Neo4j graph lookup (instant, structured)
    let result;
    try {
      result = await graphLookup(rawSkill, existingSkills);
    } catch (e) {
      console.warn("Neo4j lookup failed, falling back to AI:", e);
    }

    if (result) {
      // Track analytics
      try {
        await prisma.analyticsEvent.create({
          data: {
            event: "skill_added",
            metadata: JSON.stringify({
              rawSkill,
              normalized: result.normalizedTerm,
              source: "neo4j_graph",
              layer: result.layer,
            }),
          },
        });
      } catch {}
      return NextResponse.json(result);
    }

    // Stage 2: AI taxonomy expansion
    const aiResult = await aiTaxonomyExpansion(rawSkill, existingSkills);
    aiResult.source = "ai";

    // Stage 3: Enrich with graph data
    const graphExtra = await enrichFromGraph(
      aiResult.normalizedTerm,
      existingSkills,
      [...(aiResult.aiSuggestions || []), ...(aiResult.childSkills || []), ...(aiResult.microSkills || [])]
    );

    // Merge all suggestions (dedupe)
    const allSuggestions = [
      ...(aiResult.childSkills || []),
      ...(aiResult.microSkills || []),
      ...(aiResult.aiSuggestions || []),
      ...graphExtra,
    ];
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
