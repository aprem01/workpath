import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  findSkillNode,
  getChildren,
  getSiblings,
  getRelatedWithinHops,
  getAIProofSkills,
  createSkillNode,
  createAlias,
  createChildNodes,
  createRelatedEdges,
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
  // Filter to same vertical to prevent cross-vertical contamination
  const related = await getRelatedWithinHops(node.term, 2, 15);
  const relatedTerms = related
    .filter((r) =>
      !existingSet.has(r.term.toLowerCase()) &&
      (!node.vertical || !r.vertical || r.vertical === node.vertical)
    )
    .map((r) => r.term);

  // AI-proof recommendations — only from the SAME vertical as the matched node
  // Prevents HHA skills leaking into tech suggestions
  const aiProof = await getAIProofSkills(
    [...existingSkills, node.term],
    5
  );
  const aiProofTerms = aiProof
    .filter((s) => !node.vertical || s.vertical === node.vertical)
    .map((s) => s.term);

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

// ─── Detect if input is natural language vs. a skill keyword ────────
function isNaturalLanguage(input: string): boolean {
  const words = input.trim().split(/\s+/);
  // If 5+ words, or contains common sentence patterns, treat as natural language
  if (words.length >= 5) return true;
  const sentencePatterns = /\b(i used to|i can|i know|i worked|i have|i'm good|my job|i did|years of|experience in|i help|i do)\b/i;
  return sentencePatterns.test(input);
}

// ─── Natural Language → Multiple Skills Extraction ──────────────────
async function extractSkillsFromNaturalLanguage(
  input: string,
  existingSkills: string[]
) {
  const message = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1000,
    messages: [
      {
        role: "user",
        content: `A job seeker described their experience in natural language:
"${input}"

Their existing skill basket: ${existingSkills.join(", ") || "empty"}

Extract ALL distinct skills from their description. Return ONLY valid JSON:
{
  "extractedSkills": [
    {
      "rawPhrase": "the part of their text this came from",
      "normalizedTerm": "professional skill term",
      "category": "healthcare | trades | tech | admin | food_service | transport | education | retail | finance | legal | creative | engineering | management | other",
      "aiResistanceScore": 0-100
    }
  ],
  "aiSuggestions": ["5-10 additional skills they likely have based on their description"],
  "note": "optional encouraging note, max 15 words"
}

Rules:
- Extract 3-8 skills from natural language
- Use concrete, job-relevant terms (not abstract like "hard worker")
- Include both explicit skills ("cooking") and implied skills ("worked in restaurant" → Food Safety, Customer Service)
- Be generous — if they hint at something, include it
- aiSuggestions should be skills they probably also have but didn't mention
- Do NOT include skills already in their basket`,
      },
    ],
  });

  let text = (message.content[0] as { type: string; text: string }).text;
  text = text.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
  return JSON.parse(text);
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
        content: `You are a labor market taxonomy engine that PRESERVES the user's register.

A job seeker typed: "${rawSkill}"
Their current skill basket: ${existingSkills.join(", ") || "empty"}

CRITICAL: Caroline's beta tester Rosalyn (Chipotle manager) reported that
typing "Quality Assurance" got normalized to "Quality Control Analysis"
which then matched her with corporate jobs "out of her league". DO NOT
do this. Keep the user's register at their level.

Examples:
  "Quality Assurance" → "Quality Assurance" (already professional, leave alone)
  "Customer Service" → "Customer Service" (don't elevate to "Client Relationship Management")
  "Sales" → "Sales" (already a real skill)
  "Project Management" → "Project Management" (don't inflate to "Strategic Initiative Coordination")
  "Python" → "Python" (already a real skill)
  "cooking" → "Meal Preparation" (colloquial → professional, OK)
  "managing a team" → "Team Management" (clear improvement, OK)

RULE: If the input is already a recognizable professional skill, return
it unchanged. Only normalize when the input is colloquial or vague. Use
the LOWEST register that's still job-search-friendly.

Use the existing basket as register signal: if their skills are
service-level (Customer Service, Cooking, Cleaning), keep this one
service-level too. Don't elevate someone with line-cook skills into
corporate-jargon job postings.

Return ONLY valid JSON:
{
  "normalizedTerm": "term that PRESERVES the user's register",
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

  let text = (message.content[0] as { type: string; text: string }).text;
  // Strip markdown code fences if present
  text = text.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
  return JSON.parse(text);
}

// ─── Stage 3: Graph Enrichment ─────────────────────────────────────
// Only enrich with graph skills if the resolved skill is in the same
// vertical as the graph data. Don't mix HHA skills into a Python basket.
async function enrichFromGraph(
  normalizedTerm: string,
  category: string,
  existingSkills: string[],
  currentSuggestions: string[]
): Promise<string[]> {
  // Only enrich if the skill is in the healthcare/HHA vertical (what's in our graph)
  const graphVerticals = ["healthcare", "home_health_aide", "other"];
  if (!graphVerticals.includes(category)) return [];

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

    // ── Natural language detection ──────────────────────────────────
    // If user types a sentence like "I worked in a restaurant for 5 years"
    // extract multiple skills instead of normalizing as one skill
    if (isNaturalLanguage(rawSkill)) {
      try {
        const nlResult = await extractSkillsFromNaturalLanguage(rawSkill, existingSkills);

        // Track analytics
        try {
          await prisma.analyticsEvent.create({
            data: {
              event: "skill_added",
              metadata: JSON.stringify({
                rawSkill,
                source: "natural_language",
                extractedCount: nlResult.extractedSkills?.length || 0,
              }),
            },
          });
        } catch {}

        return NextResponse.json({
          ...nlResult,
          isNaturalLanguage: true,
          source: "natural_language",
        });
      } catch (e) {
        console.warn("NL extraction failed, falling back to standard:", e);
        // Fall through to standard normalization
      }
    }

    // Stage 1: Neo4j graph lookup (instant, structured)
    let result;
    let neo4jError = "";
    try {
      result = await graphLookup(rawSkill, existingSkills);
    } catch (e) {
      neo4jError = e instanceof Error ? e.message : String(e);
      console.error("Neo4j lookup failed:", neo4jError);
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
      aiResult.category || "other",
      existingSkills,
      [...(aiResult.aiSuggestions || []), ...(aiResult.childSkills || []), ...(aiResult.microSkills || [])]
    );

    // ─── Write-back: grow the graph with this new skill ────────────
    // Fire-and-forget — don't block the user response
    (async () => {
      try {
        // 1. Create the skill node
        await createSkillNode(
          aiResult.normalizedTerm,
          aiResult.layer || "canonical",
          aiResult.aiResistanceScore || 50,
          aiResult.category === "other" ? null : aiResult.category
        );

        // 2. Create alias from raw input → canonical
        if (rawSkill.toLowerCase().trim() !== aiResult.normalizedTerm.toLowerCase()) {
          await createAlias(rawSkill, aiResult.normalizedTerm);
        }

        // 3. Create child nodes if AI returned them
        if (aiResult.childSkills?.length > 0) {
          await createChildNodes(
            aiResult.normalizedTerm,
            aiResult.childSkills.map((term: string) => ({
              term,
              layer: "canonical",
              aiResistance: aiResult.aiResistanceScore || 50,
            }))
          );
        }

        // 4. Create micro-skill nodes
        if (aiResult.microSkills?.length > 0) {
          await createChildNodes(
            aiResult.normalizedTerm,
            aiResult.microSkills.map((term: string) => ({
              term,
              layer: "micro",
              aiResistance: aiResult.aiResistanceScore || 50,
            }))
          );
        }

        // 5. Create RELATED_TO edges with existing basket skills
        const existingInGraph: string[] = [];
        for (const es of existingSkills) {
          const node = await findSkillNode(es);
          if (node) existingInGraph.push(node.term);
        }
        if (existingInGraph.length > 0) {
          await createRelatedEdges(aiResult.normalizedTerm, existingInGraph);
        }
      } catch (e) {
        console.warn("Graph write-back failed (non-blocking):", e instanceof Error ? e.message : e);
      }
    })();

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
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error("Skill normalization error:", errMsg);
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
