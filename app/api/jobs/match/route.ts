import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Fuzzy matching: check if a user skill semantically matches a job skill
// Handles cases like "food preparation and cooking" matching "meal preparation"
function skillMatches(userTerm: string, jobTerm: string): boolean {
  const u = userTerm.toLowerCase();
  const j = jobTerm.toLowerCase();

  // Exact match
  if (u === j) return true;

  // One contains the other
  if (u.includes(j) || j.includes(u)) return true;

  // Keyword overlap — if 50%+ of job skill words appear in user skill
  const jobWords = j.split(/\s+/).filter((w) => w.length > 2);
  const userWords = u.split(/\s+/).filter((w) => w.length > 2);
  const overlap = jobWords.filter((jw) =>
    userWords.some((uw) => uw.includes(jw) || jw.includes(uw))
  );
  if (jobWords.length > 0 && overlap.length / jobWords.length >= 0.5) {
    return true;
  }

  // Common synonyms map
  const synonyms: Record<string, string[]> = {
    "meal preparation": ["cooking", "food preparation", "food prep", "cook", "making food", "making meals"],
    "light housekeeping": ["cleaning", "housework", "tidying", "house cleaning", "housekeeping"],
    "transportation assistance": ["driving", "transport", "rides", "chauffeur", "driver"],
    "personal care assistance": ["personal care", "caregiving", "caretaking", "care assistance"],
    "personal hygiene assistance": ["bathing", "hygiene", "grooming", "dressing assistance"],
    "companionship": ["companion", "social support", "keeping company", "friendly visiting"],
    "basic mobility assistance": ["mobility", "walking assistance", "movement help", "mobility support"],
    "vital signs monitoring": ["blood pressure", "vital signs", "vitals", "temperature check"],
    "medication reminders": ["medication", "medicine reminders", "pill reminders", "med reminders"],
    "medication management": ["medication", "medicine management", "med management", "prescriptions"],
    "cpr certification": ["cpr", "cardiopulmonary", "cpr certified", "cpr/aed"],
    "first aid": ["first aid", "emergency care", "basic medical"],
    "documentation": ["paperwork", "record keeping", "charting", "documenting", "reports"],
    "communication with families": ["family communication", "talking with families", "family liaison"],
    "dementia care awareness": ["dementia", "alzheimer", "memory care", "cognitive care"],
    "transfer assistance": ["transfers", "lifting", "patient transfer", "moving patients"],
    "fall prevention": ["fall risk", "falls", "preventing falls", "balance safety"],
    "wound care basics": ["wound care", "bandaging", "wound treatment"],
    "physical therapy assistance": ["physical therapy", "pt assistance", "exercise assistance", "rehab"],
    "child development basics": ["child care", "child development", "pediatric", "working with children"],
    "food safety and sanitation": ["food safety", "sanitation", "food hygiene", "kitchen safety"],
  };

  for (const [canonical, alts] of Object.entries(synonyms)) {
    const isJobCanonical = j === canonical || j.includes(canonical);
    const isUserMatch = alts.some((alt) => u.includes(alt) || alt.includes(u));
    if (isJobCanonical && isUserMatch) return true;

    const isUserCanonical = u === canonical || u.includes(canonical);
    const isJobMatch = alts.some((alt) => j.includes(alt) || alt.includes(j));
    if (isUserCanonical && isJobMatch) return true;
  }

  return false;
}

function userHasSkill(userTerms: string[], jobTerm: string): boolean {
  return userTerms.some((ut) => skillMatches(ut, jobTerm));
}

interface JobResult {
  id: string;
  title: string;
  employer: string;
  location: string;
  description: string;
  payMin: number;
  payMax: number;
  payType: string;
  shiftType: string;
  vertical: string;
  postedAt: Date;
  optionalScore: number;
  matchedRequired: number;
  totalRequired: number;
  matchedOptional: number;
  totalOptional: number;
  missingSkills: string[];
  requiredSkills: { normalizedTerm: string; isRequired: boolean }[];
  payJumpPerSkill?: Record<string, number>;
}

export async function POST(req: Request) {
  try {
    const { userSkills } = await req.json();

    if (!Array.isArray(userSkills)) {
      return NextResponse.json(
        { error: "userSkills array is required" },
        { status: 400 }
      );
    }

    const userSkillTerms = userSkills.map((s: { normalizedTerm: string }) =>
      s.normalizedTerm.toLowerCase()
    );

    const allJobs = await prisma.job.findMany({
      where: { isActive: true },
      include: { requiredSkills: true },
    });

    const qualifiedJobs: JobResult[] = [];
    const gapJobs: JobResult[] = [];

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
        (t) => !userHasSkill(userSkillTerms, t)
      );
      const matchedOptional = optionalTerms.filter((t) =>
        userHasSkill(userSkillTerms, t)
      );
      const optionalScore =
        optionalTerms.length > 0
          ? matchedOptional.length / optionalTerms.length
          : 0;

      const jobResult: JobResult = {
        id: job.id,
        title: job.title,
        employer: job.employer,
        location: job.location,
        description: job.description,
        payMin: job.payMin,
        payMax: job.payMax,
        payType: job.payType,
        shiftType: job.shiftType,
        vertical: job.vertical,
        postedAt: job.postedAt,
        optionalScore,
        matchedRequired: requiredTerms.length - missingRequired.length,
        totalRequired: requiredTerms.length,
        matchedOptional: matchedOptional.length,
        totalOptional: optionalTerms.length,
        missingSkills: missingRequired,
        requiredSkills: job.requiredSkills.map((s) => ({
          normalizedTerm: s.normalizedTerm,
          isRequired: s.isRequired,
        })),
      };

      // Relevance filter: user must match at least 1 required skill
      // (prevents showing completely unrelated jobs as gap matches)
      const matchedRequiredCount = requiredTerms.length - missingRequired.length;

      if (missingRequired.length === 0) {
        qualifiedJobs.push(jobResult);
      } else if (missingRequired.length <= 2 && matchedRequiredCount >= 1) {
        // Only show as gap job if user has SOME relevant skills for this role
        gapJobs.push(jobResult);
      }
    }

    // Sort qualified jobs by highest pay first, then by optional score
    qualifiedJobs.sort(
      (a, b) => b.payMax - a.payMax || b.optionalScore - a.optionalScore
    );

    // For gap jobs, calculate pay jump per missing skill
    // payJumpPerSkill: for each gap skill, average payMax of jobs that skill would unlock
    for (const gapJob of gapJobs) {
      const payJumpPerSkill: Record<string, number> = {};
      for (const missingSkill of gapJob.missingSkills) {
        // Find all gap jobs where this skill is the ONLY missing skill
        // (i.e., learning this one skill would unlock that job)
        const unlockableJobs = gapJobs.filter(
          (j) =>
            j.missingSkills.length === 1 &&
            j.missingSkills[0] === missingSkill
        );
        if (unlockableJobs.length > 0) {
          const avgPay =
            unlockableJobs.reduce((sum, j) => sum + j.payMax, 0) /
            unlockableJobs.length;
          payJumpPerSkill[missingSkill] = Math.round(avgPay);
        } else {
          // Also consider jobs where this is one of the missing skills
          const relevantJobs = gapJobs.filter((j) =>
            j.missingSkills.includes(missingSkill)
          );
          if (relevantJobs.length > 0) {
            const avgPay =
              relevantJobs.reduce((sum, j) => sum + j.payMax, 0) /
              relevantJobs.length;
            payJumpPerSkill[missingSkill] = Math.round(avgPay);
          }
        }
      }
      gapJob.payJumpPerSkill = payJumpPerSkill;
    }

    // Sort gap jobs: fewest missing skills first, then highest pay
    gapJobs.sort(
      (a, b) =>
        a.missingSkills.length - b.missingSkills.length ||
        b.payMax - a.payMax ||
        b.optionalScore - a.optionalScore
    );

    // Collect all unique gap skills and look up AI resistance scores
    const allGapSkills = new Set<string>();
    for (const gj of gapJobs) {
      for (const ms of gj.missingSkills) allGapSkills.add(ms);
    }

    // Look up AI resistance scores from the skill graph
    const skillNodes = await prisma.skillNode.findMany({
      where: {
        canonicalTerm: { in: Array.from(allGapSkills), mode: "insensitive" },
      },
      select: { canonicalTerm: true, aiResistanceScore: true },
    });
    const aiScoreMap: Record<string, number> = {};
    for (const sn of skillNodes) {
      aiScoreMap[sn.canonicalTerm.toLowerCase()] = sn.aiResistanceScore;
    }

    // Build gap skill summary with AI scores, sorted by impact
    const gapSkillFreq: Record<string, { count: number; totalPay: number; aiScore: number }> = {};
    for (const gj of gapJobs) {
      for (const ms of gj.missingSkills) {
        if (!gapSkillFreq[ms]) {
          gapSkillFreq[ms] = { count: 0, totalPay: 0, aiScore: aiScoreMap[ms.toLowerCase()] || 50 };
        }
        gapSkillFreq[ms].count++;
        gapSkillFreq[ms].totalPay += gj.payMax;
      }
    }

    // Sort gap skills: prioritize AI-resistant + high job unlock count
    const topGapSkills = Object.entries(gapSkillFreq)
      .map(([skill, data]) => ({
        skill,
        count: data.count,
        avgPay: Math.round(data.totalPay / data.count / 100),
        aiResistanceScore: data.aiScore,
        isAIProof: data.aiScore >= 75,
      }))
      .sort((a, b) => {
        // Prioritize: AI-proof first, then by job unlock count
        if (a.isAIProof !== b.isAIProof) return a.isAIProof ? -1 : 1;
        return b.count - a.count;
      });

    // Track analytics
    try {
      await prisma.analyticsEvent.create({
        data: {
          event: "match_revealed",
          metadata: JSON.stringify({
            skillCount: userSkillTerms.length,
            qualifiedCount: qualifiedJobs.length,
            gapCount: gapJobs.length,
          }),
        },
      });
    } catch {
      // analytics failure is non-blocking
    }

    return NextResponse.json({ qualifiedJobs, gapJobs, topGapSkills });
  } catch (error) {
    console.error("Job matching error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to match jobs", detail: message },
      { status: 500 }
    );
  }
}
