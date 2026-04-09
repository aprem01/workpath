import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const client = new Anthropic();

// Simple in-memory cache to avoid repeat Claude calls for the same skill+zip
// In production this should be Redis or Postgres
const cache = new Map<string, { data: unknown; timestamp: number }>();
const CACHE_TTL_MS = 1000 * 60 * 30; // 30 minutes

interface UpskillResource {
  title: string;
  provider: string;
  url: string;
  cost: string; // "Free", "$35", "$50-100"
  duration: string; // "4 hours", "2 days"
  isOnline: boolean;
  // For in-person:
  address?: string;
  city?: string;
  distance?: string; // "2.3 miles"
}

interface FindUpskillResponse {
  online: UpskillResource[];
  inPerson: UpskillResource[];
}

export async function POST(req: Request) {
  try {
    const { skill, zipCode } = (await req.json()) as {
      skill: string;
      zipCode?: string;
    };

    if (!skill || typeof skill !== "string") {
      return NextResponse.json(
        { error: "skill is required" },
        { status: 400 }
      );
    }

    const cacheKey = `${skill.toLowerCase().trim()}|${zipCode || ""}`;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return NextResponse.json(cached.data);
    }

    const zipContext = zipCode
      ? `The job seeker lives in ZIP code ${zipCode}. For in-person options, suggest REAL training centers, hospitals, community colleges, or chain locations (like American Red Cross, YMCA, community colleges, vocational schools) that are likely to exist near this zip code. Mention the actual neighborhood or city name when possible.`
      : `For in-person options, suggest real training providers like American Red Cross, YMCA, community colleges, or vocational schools — but mark them as nationwide chains.`;

    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1500,
      messages: [
        {
          role: "user",
          content: `You are a workforce training and certification expert. A job seeker needs to acquire this skill or certification: "${skill}"

${zipContext}

Return ONLY valid JSON (no markdown, no explanation):
{
  "online": [
    {
      "title": "Course or certification name",
      "provider": "Real provider name (Coursera, edX, Red Cross, etc.)",
      "url": "Real URL if you know it, otherwise the provider's main URL",
      "cost": "Free, $35, $50-100, etc.",
      "duration": "4 hours, 2 weeks, etc.",
      "isOnline": true
    }
  ],
  "inPerson": [
    {
      "title": "Course or certification name",
      "provider": "Real training organization",
      "url": "Provider URL if available, else empty string",
      "cost": "$45, $89-150, etc.",
      "duration": "4 hours, 2 days, etc.",
      "isOnline": false,
      "address": "Approximate area, e.g. 'Lakeview, Chicago' or 'Multiple locations'",
      "city": "City name",
      "distance": "Approximate distance, e.g. '~2 miles' or 'nationwide'"
    }
  ]
}

RULES:
- Provide 2-3 ONLINE options and 2-3 IN-PERSON options
- Only suggest REAL, well-known providers — don't invent fake training schools
- Prioritize FREE options first, then low-cost
- For in-person: only suggest providers that genuinely have training locations (Red Cross, YMCA, community colleges, hospital systems, vocational schools, fire/EMS academies)
- For online: prefer Coursera, edX, LinkedIn Learning, Khan Academy, Red Cross Online, free YouTube training, government training programs
- URLs should be real provider homepages if you don't know specific course URLs
- Be honest about costs — don't make up free if it's actually paid
- If a skill cannot be acquired through standard training (it's purely experiential), return empty arrays`,
        },
      ],
    });

    let text = (message.content[0] as { type: string; text: string }).text;
    text = text.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();

    let parsed: FindUpskillResponse;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { online: [], inPerson: [] };
    }

    cache.set(cacheKey, { data: parsed, timestamp: Date.now() });

    return NextResponse.json(parsed);
  } catch (error) {
    console.error("Upskill finder error:", error);
    return NextResponse.json({ online: [], inPerson: [] });
  }
}
