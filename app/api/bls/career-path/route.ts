import { NextResponse } from "next/server";
import {
  BLS_OCCUPATIONS,
  matchOccupationsBySkills,
  computeSkillGap,
  estimateLearningTime,
} from "@/lib/bls-data";

export const dynamic = "force-dynamic";

interface CareerPathRequest {
  currentSkills: string[];
  targetOccupation: string; // title or BLS code
  currentEducation?: string;
}

export async function POST(req: Request) {
  try {
    const body: CareerPathRequest = await req.json();
    const { currentSkills, targetOccupation, currentEducation } = body;

    if (!currentSkills || !Array.isArray(currentSkills) || currentSkills.length === 0) {
      return NextResponse.json(
        { error: "currentSkills must be a non-empty array of strings" },
        { status: 400 },
      );
    }

    if (!targetOccupation) {
      return NextResponse.json(
        { error: "targetOccupation is required (title or BLS code)" },
        { status: 400 },
      );
    }

    // Find the target occupation by title (case-insensitive) or BLS code
    const target = BLS_OCCUPATIONS.find(
      (o) =>
        o.blsCode === targetOccupation ||
        o.title.toLowerCase() === targetOccupation.toLowerCase() ||
        o.title.toLowerCase().includes(targetOccupation.toLowerCase()),
    );

    if (!target) {
      return NextResponse.json(
        {
          error: `Occupation "${targetOccupation}" not found. Use /api/bls to list available occupations.`,
        },
        { status: 404 },
      );
    }

    // Find occupations the user currently qualifies for (match >= 2 skills)
    const currentMatch = matchOccupationsBySkills(currentSkills, 2);

    // Compute the skill gap to reach the target
    const skillGap = computeSkillGap(currentSkills, target);

    // Estimate the best current pay from matched occupations
    const currentBestPay =
      currentMatch.length > 0
        ? Math.max(...currentMatch.map((o) => o.medianHourly))
        : 0;

    // Pay increase calculation
    const payIncrease = target.medianHourly - currentBestPay;
    const payIncreasePercent =
      currentBestPay > 0
        ? Math.round((payIncrease / currentBestPay) * 100)
        : null;

    // Time estimate
    const edu = currentEducation || "high school";
    const timeToReach = estimateLearningTime(
      skillGap.length,
      edu,
      target.educationRequired,
    );

    // Sort current matches by pay descending
    const sortedMatches = [...currentMatch].sort(
      (a, b) => b.medianHourly - a.medianHourly,
    );

    // Build stepping-stone path: occupations that share skills with target
    // and sit between current pay and target pay
    const steppingStones = BLS_OCCUPATIONS.filter((o) => {
      if (o.blsCode === target.blsCode) return false;
      const sharedWithTarget = target.relatedSkills.filter((ts) =>
        o.relatedSkills.some(
          (os) =>
            os.toLowerCase().includes(ts.toLowerCase()) ||
            ts.toLowerCase().includes(os.toLowerCase()),
        ),
      );
      return (
        sharedWithTarget.length >= 1 &&
        o.medianHourly >= currentBestPay &&
        o.medianHourly <= target.medianHourly
      );
    }).sort((a, b) => a.medianHourly - b.medianHourly);

    return NextResponse.json({
      currentMatch: sortedMatches.slice(0, 10),
      targetOccupation: target,
      skillGap,
      skillGapCount: skillGap.length,
      currentBestHourly: currentBestPay,
      targetHourly: target.medianHourly,
      payIncrease: Math.round(payIncrease * 100) / 100,
      payIncreasePercent,
      annualPayIncrease: Math.round(payIncrease * 2080),
      timeToReach,
      steppingStones: steppingStones.slice(0, 5),
      aiRiskNote:
        target.aiExposureScore >= 7
          ? `Warning: ${target.title} has a high AI exposure score (${target.aiExposureScore}/10). Consider pairing with skills that are harder to automate.`
          : target.aiExposureScore <= 3
            ? `${target.title} has low AI displacement risk (${target.aiExposureScore}/10), making it a resilient career choice.`
            : null,
    });
  } catch {
    return NextResponse.json(
      { error: "Invalid request body. Expected JSON with currentSkills and targetOccupation." },
      { status: 400 },
    );
  }
}
