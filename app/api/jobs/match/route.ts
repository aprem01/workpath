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
  const overlap = jobWords.filter(
    (jw) =>
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
        (t) => !userHasSkill(userSkillTerms, t)
      );
      const matchedOptional = optionalTerms.filter((t) =>
        userHasSkill(userSkillTerms, t)
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
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to match jobs", detail: message },
      { status: 500 }
    );
  }
}
