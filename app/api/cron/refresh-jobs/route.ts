import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * DISABLED 2026-11-04 — this endpoint invented job listings.
 *
 * It asked a model to "generate realistic job listings" and wrote them
 * straight to the Job table, attributed to real named Chicago employers:
 * Northwestern Memorial Hospital, Chicago Transit Authority, Kirkland &
 * Ellis, Nordstrom, Mariano's. 1,618 of 2,409 jobs in the database came
 * from here. None were real openings, and none had an apply URL, so a
 * jobseeker could never have applied to one.
 *
 * That is not a data-quality problem. It sends people who are looking
 * for work after jobs that do not exist, under the names of companies
 * that never posted them.
 *
 * Job inventory now comes only from sources with verifiable provenance.
 * Every row records where it came from, its original URL, and when it
 * was last confirmed live. See scripts/import-jobs.mjs and
 * scripts/expire-jobs.mjs.
 *
 * Do not reinstate this. If inventory is thin, add a real source.
 */
export async function GET() {
  return NextResponse.json(
    {
      error: "disabled",
      reason:
        "This endpoint generated fabricated job listings. Job inventory must come from a real source with provenance.",
    },
    { status: 410 }
  );
}

export async function POST() {
  return GET();
}
