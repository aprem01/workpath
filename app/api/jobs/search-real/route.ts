import { NextResponse } from "next/server";
import { searchAdzunaJobs, adzunaToInternal } from "@/lib/adzuna";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Search real jobs from Adzuna and optionally save to DB
export async function POST(req: Request) {
  try {
    const { query, location, vertical, saveToDb } = await req.json();

    if (!query) {
      return NextResponse.json({ error: "query is required" }, { status: 400 });
    }

    const jobs = await searchAdzunaJobs({
      what: query,
      where: location || "Chicago",
      results_per_page: 10,
      sort_by: "salary",
    });

    if (jobs.length === 0) {
      return NextResponse.json({
        source: "adzuna",
        active: !!process.env.ADZUNA_APP_ID,
        message: process.env.ADZUNA_APP_ID
          ? "No jobs found for this search"
          : "Adzuna API not configured. Set ADZUNA_APP_ID and ADZUNA_APP_KEY env vars.",
        jobs: [],
      });
    }

    const converted = jobs.map(j => adzunaToInternal(j, vertical || "other"));

    // Optionally save to database
    if (saveToDb) {
      for (const job of converted) {
        await prisma.job.create({ data: job });
      }
    }

    return NextResponse.json({
      source: "adzuna",
      count: converted.length,
      jobs: converted,
      saved: saveToDb ? converted.length : 0,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
