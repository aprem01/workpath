import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * POST /api/applications/track
 *
 * Records that a worker visited or applied to a job. Two-stage flow:
 *  1. action="viewed" — fired when the worker clicks Apply (we open
 *     the employer URL in a new tab and immediately log the visit)
 *  2. action="applied" — fired when the worker confirms "Did you
 *     apply?" with Yes
 *
 * We don't store the Adzuna job as a Job row (jobs are transient API
 * results, not durable). Instead we log to AnalyticsEvent which is
 * the canonical store for cross-event reporting. Skilmatch's admin
 * can then aggregate "how many candidates applied to similar roles"
 * by joining on the basket's industry.
 *
 * Body:
 *  {
 *    anonymousHandle: string,
 *    jobId: string,
 *    jobTitle: string,
 *    employer?: string,
 *    location?: string,
 *    vertical?: string,
 *    payMin?: number,
 *    payMax?: number,
 *    applyUrl?: string,
 *    action: "viewed" | "applied",
 *  }
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      anonymousHandle,
      jobId,
      jobTitle,
      employer,
      location,
      vertical,
      payMin,
      payMax,
      applyUrl,
      action,
    } = body;

    if (
      typeof anonymousHandle !== "string" ||
      typeof jobId !== "string" ||
      typeof jobTitle !== "string" ||
      (action !== "viewed" && action !== "applied")
    ) {
      return NextResponse.json(
        { error: "anonymousHandle, jobId, jobTitle, action required" },
        { status: 400 }
      );
    }

    // Look up the user. If we don't find one, we still log the event —
    // the worker might be applying before completing the profile sync.
    // anonymousHandle is in the metadata regardless.
    const user = await prisma.user.findUnique({
      where: { anonymousHandle },
      select: { id: true },
    });

    await prisma.analyticsEvent.create({
      data: {
        event: action === "viewed" ? "application_viewed" : "application_applied",
        userId: user?.id || null,
        metadata: JSON.stringify({
          anonymousHandle,
          jobId,
          jobTitle,
          employer: employer || null,
          location: location || null,
          vertical: vertical || null,
          payMin: payMin ?? null,
          payMax: payMax ?? null,
          applyUrl: applyUrl || null,
        }),
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : "unknown";
    console.error("application track error:", errMsg);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
