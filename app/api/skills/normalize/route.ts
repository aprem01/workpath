import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

const client = new Anthropic();

// Canonical skill terms used in our job listings — AI should normalize toward these
const CANONICAL_SKILLS = [
  "personal care assistance",
  "companionship",
  "meal preparation",
  "basic mobility assistance",
  "light housekeeping",
  "medication reminders",
  "transportation assistance",
  "vital signs monitoring",
  "personal hygiene assistance",
  "documentation",
  "cpr certification",
  "wound care basics",
  "physical therapy assistance",
  "dementia care awareness",
  "transfer assistance",
  "fall prevention",
  "medication management",
  "communication with families",
  "child development basics",
  "first aid",
];

export async function POST(req: Request) {
  try {
    const { rawSkill, existingSkills } = await req.json();

    if (!rawSkill || typeof rawSkill !== "string") {
      return NextResponse.json(
        { error: "rawSkill is required" },
        { status: 400 }
      );
    }

    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 500,
      messages: [
        {
          role: "user",
          content: `You are a labor market taxonomy expert. A job seeker typed this skill: "${rawSkill}"

Existing skills they already added: ${existingSkills?.join(", ") || "none yet"}

IMPORTANT: Our job database uses these canonical skill terms. If the user's skill matches or is very close to one of these, use the EXACT canonical term:
${CANONICAL_SKILLS.map((s) => `- ${s}`).join("\n")}

Return ONLY valid JSON (no markdown, no explanation):
{
  "normalizedTerm": "use the exact canonical term from the list above if it matches, otherwise use a clear professional term",
  "category": "one of: healthcare, trades, tech, admin, food_service, transport, education, retail, other",
  "proficiencyLevel": "one of: beginner, intermediate, advanced",
  "isRecognized": true or false,
  "aiSuggestions": ["up to 3 related skills from the canonical list above that the user likely also has"],
  "note": "optional short plain-language note to show the user, max 10 words, empty string if none"
}

Rules:
- "cooking", "cook", "making food" → use "meal preparation"
- "cleaning", "housework", "tidying" → use "light housekeeping"
- "driving", "rides", "car" → use "transportation assistance"
- "helping people bathe/dress" → use "personal hygiene assistance"
- "taking blood pressure/temperature" → use "vital signs monitoring"
- If the skill is vague (e.g. "good with people"), normalize to the closest canonical term
- If no canonical term fits, use a clear professional term in lowercase
- Suggestions should prioritize terms from the canonical list
- Use plain language the user would recognize`,
        },
      ],
    });

    const text = (message.content[0] as { type: string; text: string }).text;
    const parsed = JSON.parse(text);
    // Ensure lowercase for consistent matching
    parsed.normalizedTerm = parsed.normalizedTerm.toLowerCase();
    if (parsed.aiSuggestions) {
      parsed.aiSuggestions = parsed.aiSuggestions.map((s: string) =>
        s.toLowerCase()
      );
    }
    return NextResponse.json(parsed);
  } catch (error) {
    console.error("Skill normalization error:", error);
    const body = await req.clone().json().catch(() => ({ rawSkill: "" }));
    return NextResponse.json({
      normalizedTerm: body.rawSkill?.toLowerCase() || "unknown skill",
      category: "other",
      proficiencyLevel: "beginner",
      isRecognized: false,
      aiSuggestions: [],
      note: "We couldn't process this skill right now",
    });
  }
}
