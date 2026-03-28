import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const client = new Anthropic();

// Given a skill node, find related skills from the graph:
// siblings (same parent), children, parent's other children, etc.
async function getGraphRelatedSkills(
  canonicalTerm: string,
  existingSkills: string[]
): Promise<string[]> {
  const existingSet = new Set(
    existingSkills.map((s) => s.toLowerCase())
  );
  existingSet.add(canonicalTerm.toLowerCase());

  const related: string[] = [];

  // Find the node
  const node = await prisma.skillNode.findUnique({
    where: { canonicalTerm },
    include: {
      children: true,
      parent: { include: { children: true } },
    },
  });

  if (!node) return related;

  // Add children
  for (const child of node.children) {
    if (!existingSet.has(child.canonicalTerm.toLowerCase())) {
      related.push(child.canonicalTerm);
      existingSet.add(child.canonicalTerm.toLowerCase());
    }
  }

  // Add siblings (other children of same parent)
  if (node.parent) {
    for (const sibling of node.parent.children) {
      if (!existingSet.has(sibling.canonicalTerm.toLowerCase())) {
        related.push(sibling.canonicalTerm);
        existingSet.add(sibling.canonicalTerm.toLowerCase());
      }
    }
  }

  // Also find skills in the same vertical that are commonly co-occurring
  const sameVertical = await prisma.skillNode.findMany({
    where: {
      vertical: "home_health_aide",
      layer: "canonical",
      canonicalTerm: { notIn: Array.from(existingSet) },
    },
    take: 10,
    orderBy: { aiResistanceScore: "desc" },
  });

  for (const sv of sameVertical) {
    if (!existingSet.has(sv.canonicalTerm.toLowerCase())) {
      related.push(sv.canonicalTerm);
      existingSet.add(sv.canonicalTerm.toLowerCase());
    }
  }

  return related;
}

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

    // First check if we have an alias in the skill graph
    const alias = await prisma.skillAlias.findUnique({
      where: { rawTerm: rawSkill.toLowerCase().trim() },
      include: {
        skillNode: { include: { children: true, parent: true } },
      },
    });

    if (alias) {
      const node = alias.skillNode;

      // Get rich related skills from the graph
      const graphRelated = await getGraphRelatedSkills(
        node.canonicalTerm,
        existingSkills
      );

      // Track analytics
      try {
        await prisma.analyticsEvent.create({
          data: {
            event: "skill_added",
            metadata: JSON.stringify({
              rawSkill,
              normalized: node.canonicalTerm,
              source: "graph_alias",
            }),
          },
        });
      } catch {}

      return NextResponse.json({
        normalizedTerm: node.canonicalTerm,
        category: node.vertical || "other",
        layer: node.layer,
        isRecognized: true,
        aiResistanceScore: node.aiResistanceScore,
        childSkills: node.children.map((c) => c.canonicalTerm),
        aiSuggestions: graphRelated,
        note: "",
      });
    }

    // Fall back to Claude AI normalization — ask for MORE suggestions
    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 800,
      messages: [
        {
          role: "user",
          content: `You are a labor market skill graph expert for the home health aide and caregiving vertical.

A job seeker typed: "${rawSkill}"
Their current skill basket: ${existingSkills.join(", ") || "empty"}

Return ONLY valid JSON (no markdown):
{
  "normalizedTerm": "official professional term",
  "category": "healthcare | trades | tech | admin | food_service | transport | education | retail | other",
  "layer": "canonical",
  "isRecognized": true or false,
  "aiResistanceScore": 0-100 (physical/interpersonal=85-95, monitoring=50-60, documentation=40-50, routine admin=20-40),
  "childSkills": ["if this is a broad category, list 3-5 specific sub-skills"],
  "aiSuggestions": ["8-12 related professional skills they likely also have or should consider, based on ALL skills in their basket"],
  "payImpact": "optional one sentence on pay impact in HHA vertical",
  "note": "optional plain-English note, max 12 words, empty string if none"
}

Rules:
- Normalize vague input to closest professional term
- Home health aide vertical priority: caregiving, mobility, hygiene, medication, vitals, dementia care, transport
- aiSuggestions should be 8-12 skills that are RELATED to both the new skill AND the existing basket
- Include a mix: some they probably already have, some that would unlock higher-paying jobs
- Do NOT repeat skills already in their basket
- aiResistanceScore: hands-on physical care = 85-95, interpersonal/emotional = 80-90, documentation = 40-60
- Use plain language the user would recognize`,
        },
      ],
    });

    const text = (message.content[0] as { type: string; text: string }).text;
    const parsed = JSON.parse(text);

    // Also supplement with graph-based suggestions
    const graphRelated = await getGraphRelatedSkills(
      parsed.normalizedTerm,
      existingSkills
    );

    // Merge AI suggestions with graph suggestions (dedupe)
    const allSuggestions = [...(parsed.aiSuggestions || [])];
    const sugSet = new Set(allSuggestions.map((s: string) => s.toLowerCase()));
    for (const gs of graphRelated) {
      if (!sugSet.has(gs.toLowerCase())) {
        allSuggestions.push(gs);
        sugSet.add(gs.toLowerCase());
      }
    }
    parsed.aiSuggestions = allSuggestions;

    // Track analytics
    try {
      await prisma.analyticsEvent.create({
        data: {
          event: "skill_added",
          metadata: JSON.stringify({
            rawSkill,
            normalized: parsed.normalizedTerm,
            source: "ai",
          }),
        },
      });
    } catch {}

    return NextResponse.json(parsed);
  } catch (error) {
    console.error("Skill normalization error:", error);
    return NextResponse.json({
      normalizedTerm: rawSkill || "unknown skill",
      category: "other",
      layer: "canonical",
      isRecognized: false,
      aiResistanceScore: 50,
      childSkills: [],
      aiSuggestions: [],
      note: "",
    });
  }
}
