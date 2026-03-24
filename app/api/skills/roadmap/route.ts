import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const client = new Anthropic();

export async function POST(req: Request) {
  try {
    const { userSkills, targetRole } = await req.json();

    if (!Array.isArray(userSkills) || userSkills.length === 0) {
      return NextResponse.json(
        { error: "userSkills array is required" },
        { status: 400 }
      );
    }

    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      messages: [
        {
          role: "user",
          content: `You are a career advisor specializing in workforce development and AI-era job transitions.

A job seeker has these skills: ${userSkills.join(", ")}
${targetRole ? `They are interested in: ${targetRole}` : "They are in the home health aide / caregiving sector in Chicago."}

Analyze their situation and return ONLY valid JSON (no markdown):
{
  "currentStrengths": "1-2 sentence summary of what they're good at",
  "aiRiskAssessment": {
    "overallRisk": "low" or "medium" or "high",
    "summary": "1 sentence on how AI affects their current skill set",
    "atRiskSkills": ["skills from their list that AI could replace"],
    "safeSkills": ["skills from their list that are AI-resistant (human touch, physical care, emotional intelligence)"]
  },
  "recommendedSkills": [
    {
      "skill": "specific skill name",
      "why": "1 sentence on why this matters for their career",
      "estimatedHours": number (realistic estimate),
      "aiResistant": true or false,
      "careerImpact": "high" or "medium",
      "unlocks": "what jobs or pay increases this enables"
    }
  ],
  "careerPaths": [
    {
      "title": "role title they could reach",
      "currentMatch": "percentage as string like '70%'",
      "skillsNeeded": number of additional skills needed,
      "payRange": "estimated hourly pay range",
      "timeToReach": "estimated time like '2-3 months'"
    }
  ],
  "aiProofTip": "1 actionable sentence about staying relevant in an AI economy, specific to their field"
}

Rules:
- Recommend 3-5 skills, prioritized by career impact and AI-resistance
- Career paths should be realistic and achievable within 6 months
- Be encouraging but honest about AI risks
- Focus on the home health / caregiving / trades sectors
- Emphasize human skills that AI cannot replace: empathy, physical care, trust-building
- Use plain language a high school graduate would understand`
        },
      ],
    });

    const text = (message.content[0] as { type: string; text: string }).text;
    const parsed = JSON.parse(text);
    return NextResponse.json(parsed);
  } catch (error) {
    console.error("Roadmap generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate roadmap" },
      { status: 500 }
    );
  }
}
