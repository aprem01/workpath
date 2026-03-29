import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // Allow up to 60s for cron

const client = new Anthropic();

const VERTICALS = [
  "home_health_aide",
  "tech",
  "trades",
  "admin",
  "food_service",
  "transport",
  "retail",
];

export async function GET(req: Request) {
  // Verify cron secret (Vercel sends this header)
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results = [];

  for (const vertical of VERTICALS) {
    try {
      const message = await client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1500,
        messages: [{
          role: "user",
          content: `Generate 2 realistic NEW job listings for the ${vertical} vertical in Chicago, IL.

Return ONLY valid JSON (no markdown):
{"jobs": [
  {
    "title": "job title",
    "employer": "realistic Chicago company name",
    "location": "specific area, Chicago, IL",
    "description": "2-3 sentence realistic description",
    "payMin": hourly_cents_min,
    "payMax": hourly_cents_max,
    "payType": "hourly",
    "shiftType": "full_time | part_time | per_diem | contract",
    "requiredSkills": [
      {"normalizedTerm": "skill", "proficiencyLevel": "beginner|intermediate|advanced", "isRequired": true}
    ]
  }
]}

Use current BLS median pay for this vertical. Make jobs distinct from common listings.`
        }]
      });

      let text = (message.content[0] as { type: string; text: string }).text;
      text = text.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
      const { jobs } = JSON.parse(text);

      for (const { requiredSkills, ...jobData } of jobs) {
        await prisma.job.create({
          data: { ...jobData, vertical, requiredSkills: { create: requiredSkills } },
        });
      }

      results.push({ vertical, created: jobs.length });
    } catch (e) {
      results.push({ vertical, error: e instanceof Error ? e.message : "failed" });
    }
  }

  // Track in analytics
  try {
    await prisma.analyticsEvent.create({
      data: {
        event: "cron_job_refresh",
        metadata: JSON.stringify({ results, timestamp: new Date().toISOString() }),
      },
    });
  } catch {}

  return NextResponse.json({ success: true, results });
}
