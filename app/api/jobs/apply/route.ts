import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * POST /api/jobs/apply
 *
 * Anonymous application form for Skilmatch-posted jobs (id starts with
 * "db_"). Adzuna listings still route the user off-site so this endpoint
 * is only for DB-backed jobs.
 *
 * Caroline 8/23 Round 8 requirement: PayRanker should submit an
 * anonymous application to Skilmatch on the user's behalf. The employer
 * only sees the anonymous handle plus the skill basket — no PII —
 * until they explicitly send an interview request that the jobseeker
 * accepts.
 *
 * Body:
 *   {
 *     handle: string        // anonymous handle
 *     jobId: string         // "db_<Job.id>" as surfaced by /jobs
 *     coverNote?: string    // optional short message to the recruiter
 *   }
 */
export async function POST(req: Request) {
  try {
    // Basic CSRF guard: require the request to come from a known origin
    // (the deployed workpath UI). This isn't a full auth flow — a real
    // login system with session tokens is the next step — but it blocks
    // an attacker sending cross-site POSTs impersonating an arbitrary
    // handle from a phishing page. Bypasses when Origin is unset (curl,
    // some server-to-server callers).
    const origin = req.headers.get("origin");
    // Exact-string origin match. Substring/startsWith would let
    // https://workpath-iota.vercel.app.evil.example bypass the check.
    const ALLOWED_ORIGINS = new Set([
      "https://workpath-iota.vercel.app",
      "http://localhost:3000",
      "http://localhost:3001",
    ]);
    if (origin && !ALLOWED_ORIGINS.has(origin)) {
      return NextResponse.json(
        { error: "Origin not allowed" },
        { status: 403 }
      );
    }

    const { handle, jobId, coverNote } = await req.json();
    if (!handle || typeof handle !== "string") {
      return NextResponse.json({ error: "handle required" }, { status: 400 });
    }
    if (!jobId || typeof jobId !== "string") {
      return NextResponse.json({ error: "jobId required" }, { status: 400 });
    }
    // Strip the "db_" prefix the /jobs UI applies to Skilmatch DB rows.
    const realJobId = jobId.startsWith("db_") ? jobId.slice(3) : jobId;

    const user = await prisma.user.findUnique({
      where: { anonymousHandle: handle },
    });
    if (!user) {
      return NextResponse.json(
        { error: "profile not found — create a profile before applying" },
        { status: 404 }
      );
    }
    const job = await prisma.job.findUnique({ where: { id: realJobId } });
    if (!job) {
      return NextResponse.json({ error: "job not found" }, { status: 404 });
    }

    // Idempotent — don't create duplicates when the user clicks twice.
    const existing = await prisma.application.findFirst({
      where: { userId: user.id, jobId: job.id },
    });
    if (existing) {
      return NextResponse.json({
        ok: true,
        applicationId: existing.id,
        alreadyApplied: true,
      });
    }

    const created = await prisma.application.create({
      data: {
        userId: user.id,
        jobId: job.id,
        status: "applied",
      },
    });

    // Analytics
    try {
      await prisma.analyticsEvent.create({
        data: {
          event: "candidate_applied_db_job",
          metadata: JSON.stringify({
            handle,
            jobId: job.id,
            jobTitle: job.title,
            employer: job.employer,
            hasCoverNote: !!coverNote,
          }),
        },
      });
    } catch {}

    return NextResponse.json({
      ok: true,
      applicationId: created.id,
      alreadyApplied: false,
    });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : "unknown";
    console.error("apply error:", errMsg);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
