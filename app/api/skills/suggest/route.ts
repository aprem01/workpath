import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const client = new Anthropic();

export async function POST(req: Request) {
  try {
    const { gapSkill } = await req.json();

    if (!gapSkill || typeof gapSkill !== "string") {
      return NextResponse.json(
        { error: "gapSkill is required" },
        { status: 400 }
      );
    }

    // Check database first
    const dbResources = await prisma.upskillResource.findMany({
      where: { skillTerm: gapSkill.toLowerCase() },
    });

    if (dbResources.length > 0) {
      return NextResponse.json({
        resources: dbResources.map((r) => ({
          title: r.title,
          provider: r.provider,
          url: r.url,
          isFree: r.isFree,
          estimatedHours: r.durationHrs,
          difficulty: "beginner",
        })),
      });
    }

    // Fall back to AI suggestion
    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 300,
      messages: [
        {
          role: "user",
          content: `A job seeker needs to learn: "${gapSkill}"

Return ONLY valid JSON:
{
  "resources": [
    {
      "title": "course/resource title",
      "provider": "platform name",
      "url": "",
      "isFree": true or false,
      "estimatedHours": number,
      "difficulty": "beginner or intermediate"
    }
  ]
}

Suggest 1–2 real resources. Prioritize free ones (YouTube, Khan Academy, government training sites). Leave url as empty string if unsure.`,
        },
      ],
    });

    const text = (message.content[0] as { type: string; text: string }).text;
    const parsed = JSON.parse(text);
    return NextResponse.json(parsed);
  } catch (error) {
    console.error("Skill suggestion error:", error);
    return NextResponse.json({
      resources: [
        {
          title: "Learn this skill",
          provider: "Search online",
          url: "",
          isFree: true,
          estimatedHours: 3,
          difficulty: "beginner",
        },
      ],
    });
  }
}
