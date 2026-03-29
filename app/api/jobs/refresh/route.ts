import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const client = new Anthropic();

// Generate realistic job listings for a given vertical and location
export async function POST(req: Request) {
  try {
    const { vertical, location, count } = await req.json();

    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      messages: [{
        role: "user",
        content: `Generate ${count || 5} realistic job listings for the ${vertical} vertical in ${location || "Chicago, IL"}.

Return ONLY valid JSON (no markdown):
{
  "jobs": [
    {
      "title": "job title",
      "employer": "realistic company name",
      "location": "specific neighborhood/area, City, State",
      "description": "2-3 sentence realistic job description",
      "payMin": hourly_pay_in_cents_min,
      "payMax": hourly_pay_in_cents_max,
      "payType": "hourly",
      "shiftType": "full_time | part_time | per_diem | contract",
      "requiredSkills": [
        {"normalizedTerm": "skill name", "proficiencyLevel": "beginner|intermediate|advanced", "isRequired": true},
        {"normalizedTerm": "optional skill", "proficiencyLevel": "beginner", "isRequired": false}
      ]
    }
  ]
}

Rules:
- Use realistic Chicago-area employer names
- Pay rates should match current BLS median for this vertical
- Required skills should use professional terminology
- Each job should have 2-5 required skills and 1-3 optional skills
- Include a mix of entry-level and experienced positions
- Descriptions should be specific and realistic, not generic`
      }]
    });

    let text = (message.content[0] as { type: string; text: string }).text;
    text = text.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
    const { jobs } = JSON.parse(text);

    // Save to database
    const created = [];
    for (const job of jobs) {
      const { requiredSkills, ...jobData } = job;
      const saved = await prisma.job.create({
        data: {
          ...jobData,
          vertical,
          requiredSkills: { create: requiredSkills },
        },
      });
      created.push(saved);
    }

    return NextResponse.json({
      created: created.length,
      jobs: created,
      message: `Generated ${created.length} ${vertical} jobs in ${location || "Chicago, IL"}`
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("Job refresh error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
