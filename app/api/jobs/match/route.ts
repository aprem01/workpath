import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { userSkills } = await req.json();

    if (!Array.isArray(userSkills)) {
      return NextResponse.json(
        { error: "userSkills array is required" },
        { status: 400 }
      );
    }

    const userSkillTerms = new Set(
      userSkills.map((s: { normalizedTerm: string }) =>
        s.normalizedTerm.toLowerCase()
      )
    );

    const allJobs = await prisma.job.findMany({
      where: { isActive: true },
      include: { requiredSkills: true },
    });

    const qualifiedJobs: Array<{
      id: string;
      title: string;
      employer: string;
      location: string;
      description: string;
      payMin: number;
      payMax: number;
      payType: string;
      vertical: string;
      postedAt: Date;
      optionalScore: number;
      matchedRequired: number;
      totalRequired: number;
      matchedOptional: number;
      totalOptional: number;
      missingSkills: string[];
    }> = [];

    const gapJobs: typeof qualifiedJobs = [];

    for (const job of allJobs) {
      const requiredSkills = job.requiredSkills.filter((s) => s.isRequired);
      const optionalSkills = job.requiredSkills.filter((s) => !s.isRequired);

      const requiredTerms = requiredSkills.map((s) =>
        s.normalizedTerm.toLowerCase()
      );
      const optionalTerms = optionalSkills.map((s) =>
        s.normalizedTerm.toLowerCase()
      );

      const missingRequired = requiredTerms.filter(
        (t) => !userSkillTerms.has(t)
      );
      const matchedOptional = optionalTerms.filter((t) =>
        userSkillTerms.has(t)
      );
      const optionalScore =
        optionalTerms.length > 0
          ? matchedOptional.length / optionalTerms.length
          : 0;

      const jobResult = {
        id: job.id,
        title: job.title,
        employer: job.employer,
        location: job.location,
        description: job.description,
        payMin: job.payMin,
        payMax: job.payMax,
        payType: job.payType,
        vertical: job.vertical,
        postedAt: job.postedAt,
        optionalScore,
        matchedRequired: requiredTerms.length - missingRequired.length,
        totalRequired: requiredTerms.length,
        matchedOptional: matchedOptional.length,
        totalOptional: optionalTerms.length,
        missingSkills: missingRequired,
      };

      if (missingRequired.length === 0) {
        qualifiedJobs.push(jobResult);
      } else if (missingRequired.length <= 2) {
        gapJobs.push(jobResult);
      }
    }

    qualifiedJobs.sort((a, b) => b.optionalScore - a.optionalScore);
    gapJobs.sort(
      (a, b) =>
        a.missingSkills.length - b.missingSkills.length ||
        b.optionalScore - a.optionalScore
    );

    return NextResponse.json({ qualifiedJobs, gapJobs });
  } catch (error) {
    console.error("Job matching error:", error);
    return NextResponse.json(
      { error: "Failed to match jobs" },
      { status: 500 }
    );
  }
}
