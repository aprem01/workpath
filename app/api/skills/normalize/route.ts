import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

const client = new Anthropic();

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

Return ONLY valid JSON (no markdown, no explanation):
{
  "normalizedTerm": "the official professional term for this skill",
  "category": "one of: healthcare, trades, tech, admin, food_service, transport, education, retail, other",
  "proficiencyLevel": "one of: beginner, intermediate, advanced",
  "isRecognized": true or false,
  "aiSuggestions": ["up to 3 related professional skills they likely also have, as normalized terms"],
  "note": "optional short plain-language note to show the user, max 10 words, empty string if none"
}

Rules:
- If the skill is vague (e.g. "good with people"), normalize to the closest real professional term
- If unrecognizable, set isRecognized: false and make a best guess
- Suggestions should be skills that commonly co-occur with this one in the home health aide / caregiving / trades verticals
- Use plain language the user would recognize, not HR jargon`,
        },
      ],
    });

    const text = (message.content[0] as { type: string; text: string }).text;
    const parsed = JSON.parse(text);
    return NextResponse.json(parsed);
  } catch (error) {
    console.error("Skill normalization error:", error);
    // Fallback: return the raw input as-is
    const body = await req.clone().json().catch(() => ({ rawSkill: "" }));
    return NextResponse.json({
      normalizedTerm: body.rawSkill || "unknown skill",
      category: "other",
      proficiencyLevel: "beginner",
      isRecognized: false,
      aiSuggestions: [],
      note: "We couldn't process this skill right now",
    });
  }
}
