import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // Job counts by vertical
    const verticalCounts = await prisma.job.groupBy({
      by: ["vertical"],
      _count: true,
      _avg: { payMax: true },
      where: { isActive: true },
    });

    // Most in-demand skills (appears in most jobs)
    const allSkills = await prisma.jobSkill.groupBy({
      by: ["normalizedTerm"],
      _count: true,
      where: { isRequired: true },
      orderBy: { _count: { normalizedTerm: "desc" } },
      take: 20,
    });

    // Highest paying skills (avg payMax of jobs requiring this skill)
    const totalJobs = await prisma.job.count({ where: { isActive: true } });
    const totalSkillLinks = await prisma.jobSkill.count();

    return NextResponse.json({
      totalJobs,
      totalSkillLinks,
      byVertical: verticalCounts.map(v => ({
        vertical: v.vertical,
        count: v._count,
        avgPayMax: v._avg.payMax ? Math.round(v._avg.payMax / 100) : 0,
      })),
      topSkills: allSkills.map(s => ({
        skill: s.normalizedTerm,
        demandCount: s._count,
      })),
    });
  } catch {
    return NextResponse.json({ error: "Failed to get stats" }, { status: 500 });
  }
}
