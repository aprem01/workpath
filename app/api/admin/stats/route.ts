import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * Admin analytics endpoint.
 *
 * Auth: simple shared secret in Authorization header
 *   curl -H "Authorization: Bearer $ADMIN_SECRET" .../api/admin/stats
 * or via ?key=... query param for browser viewing.
 *
 * Returns aggregated stats for the last 24h / 7d / 30d windows so we
 * can spot Marielee-style regressions (lots of users seeing 0 matches,
 * Adzuna failures, etc.) before users have to tell us.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const auth = req.headers.get("authorization") || "";
  const queryKey = url.searchParams.get("key") || "";
  const provided = auth.replace(/^Bearer\s+/i, "") || queryKey;
  const secret = process.env.ADMIN_SECRET;

  if (!secret || provided !== secret) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const now = Date.now();
  const oneDay = 24 * 60 * 60 * 1000;
  const cutoffs = {
    "24h": new Date(now - oneDay),
    "7d": new Date(now - 7 * oneDay),
    "30d": new Date(now - 30 * oneDay),
  };

  async function statsForWindow(since: Date) {
    const events = await prisma.analyticsEvent.findMany({
      where: { event: "job_match", createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
    });

    let totalRequests = 0;
    let zeroMatchRequests = 0;
    let errorRequests = 0;
    let totalQualified = 0;
    let totalGap = 0;
    let totalDuration = 0;
    let avgSkillCount = 0;
    const skillCounts: Record<string, number> = {};
    const recentZeroMatches: { skills: string[]; at: string }[] = [];

    for (const ev of events) {
      let m: Record<string, unknown> = {};
      try {
        m = JSON.parse(ev.metadata || "{}");
      } catch {}
      totalRequests++;
      if (m.error) {
        errorRequests++;
        continue;
      }
      const sc = (m.skillCount as number) || 0;
      const qc = (m.qualifiedCount as number) || 0;
      const gc = (m.gapCount as number) || 0;
      const skills = (m.skills as string[]) || [];

      totalQualified += qc;
      totalGap += gc;
      totalDuration += (m.durationMs as number) || 0;
      avgSkillCount += sc;

      for (const s of skills) {
        skillCounts[s] = (skillCounts[s] || 0) + 1;
      }

      if (m.isEmpty) {
        zeroMatchRequests++;
        if (recentZeroMatches.length < 10) {
          recentZeroMatches.push({
            skills: skills.slice(0, 8),
            at: ev.createdAt.toISOString(),
          });
        }
      }
    }

    const topSkills = Object.entries(skillCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([skill, count]) => ({ skill, count }));

    return {
      totalRequests,
      zeroMatchRequests,
      zeroMatchRate:
        totalRequests > 0 ? zeroMatchRequests / totalRequests : 0,
      errorRequests,
      avgQualifiedPerRequest:
        totalRequests > 0 ? totalQualified / totalRequests : 0,
      avgGapPerRequest:
        totalRequests > 0 ? totalGap / totalRequests : 0,
      avgDurationMs:
        totalRequests > 0 ? Math.round(totalDuration / totalRequests) : 0,
      avgSkillCount:
        totalRequests > 0
          ? Math.round((avgSkillCount / totalRequests) * 10) / 10
          : 0,
      topSkills,
      recentZeroMatches,
    };
  }

  const [last24h, last7d, last30d] = await Promise.all([
    statsForWindow(cutoffs["24h"]),
    statsForWindow(cutoffs["7d"]),
    statsForWindow(cutoffs["30d"]),
  ]);

  // Also get overall counts of all event types
  const eventCounts = await prisma.analyticsEvent.groupBy({
    by: ["event"],
    _count: true,
  });

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    eventCounts,
    windows: {
      "24h": last24h,
      "7d": last7d,
      "30d": last30d,
    },
  });
}
