import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const client = new Anthropic();

export async function POST(req: Request) {
  let rawSkill = "";
  try {
    const body = await req.json();
    rawSkill = body.rawSkill;
    const existingSkills = body.existingSkills;

    if (!rawSkill || typeof rawSkill !== "string") {
      return NextResponse.json({ error: "rawSkill is required" }, { status: 400 });
    }

    // First check if we have an alias in the skill graph
    const alias = await prisma.skillAlias.findUnique({
      where: { rawTerm: rawSkill.toLowerCase().trim() },
      include: { skillNode: { include: { children: true, parent: true } } },
    });

    if (alias) {
      const node = alias.skillNode;
      const childTerms = node.children.map((c) => c.canonicalTerm);
      return NextResponse.json({
        normalizedTerm: node.canonicalTerm,
        category: node.vertical || "other",
        layer: node.layer,
        isRecognized: true,
        aiResistanceScore: node.aiResistanceScore,
        childSkills: childTerms,
        aiSuggestions: childTerms.length > 0 ? childTerms.slice(0, 3) : [],
        note: "",
      });
    }

    // Fall back to Claude AI normalization
    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 500,
      messages: [
        {
          role: "user",
          content: `You are a labor market skill graph expert for the home health aide and caregiving vertical.

A job seeker typed: "${rawSkill}"
Their current skill basket: ${(existingSkills || []).join(", ") || "empty"}

Return ONLY valid JSON (no markdown):
{
  "normalizedTerm": "official professional term",
  "category": "healthcare | trades | tech | admin | food_service | transport | education | retail | other",
  "layer": "canonical",
  "isRecognized": true or false,
  "aiResistanceScore": 0-100 (physical/interpersonal=85-95, monitoring=50-60, documentation=40-50, routine admin=20-40),
  "childSkills": [],
  "aiSuggestions": ["up to 3 related professional skills they likely also have"],
  "payImpact": "optional one sentence on pay impact in HHA vertical",
  "note": "optional plain-English note, max 12 words, empty string if none"
}

Rules:
- Normalize vague input to closest professional term
- Home health aide vertical priority
- aiResistanceScore: hands-on physical care = 85-95, interpersonal/emotional = 80-90, documentation = 40-60
- Use plain language the user would recognize`,
        },
      ],
    });

    const text = (message.content[0] as { type: string; text: string }).text;
    const parsed = JSON.parse(text);

    // Track analytics
    try {
      await prisma.analyticsEvent.create({
        data: {
          event: "skill_added",
          metadata: JSON.stringify({ rawSkill, normalized: parsed.normalizedTerm }),
        },
      });
    } catch {
      // analytics failure is non-blocking
    }

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
