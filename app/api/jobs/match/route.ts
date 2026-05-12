import { NextResponse } from "next/server";
import { searchJobsForSkills, adzunaToInternal } from "@/lib/adzuna";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** Fire-and-forget analytics log (never blocks the user-facing response) */
async function logMatchEvent(metadata: Record<string, unknown>) {
  try {
    await prisma.analyticsEvent.create({
      data: {
        event: "job_match",
        metadata: JSON.stringify(metadata),
      },
    });
  } catch {
    // analytics failure is non-blocking
  }
}

export async function POST(req: Request) {
  const startTime = Date.now();
  try {
    const { userSkills } = await req.json();
    if (!Array.isArray(userSkills) || userSkills.length === 0) {
      return NextResponse.json(
        { error: "userSkills array is required" },
        { status: 400 }
      );
    }

    const skillTerms = userSkills.map(
      (s: { normalizedTerm: string }) => s.normalizedTerm
    );

    // Compute the dominant vertical of the user's skill set — used to filter
    // out off-register jobs (Caroline's HHA query was getting VP/Director
    // titles in Tab B because Adzuna's keyword search matched noise in
    // descriptions).
    const userVertical = detectUserVertical(skillTerms);

    // Search Adzuna with user's skills
    const { qualified: exactJobs, broader: broaderJobs } =
      await searchJobsForSkills(skillTerms);

    // Convert to our format
    const qualifiedJobs = exactJobs.map((aj, i) => {
      const converted = adzunaToInternal(aj, detectVertical(aj));
      return {
        id: `adzuna_${aj.id || i}`,
        title: converted.title,
        employer: converted.employer,
        location: converted.location,
        description: converted.description,
        payMin: converted.payMin,
        payMax: converted.payMax,
        payType: converted.payType,
        shiftType: converted.shiftType,
        vertical: converted.vertical,
        postedAt: new Date(aj.created || Date.now()),
        optionalScore: 0,
        matchedRequired: skillTerms.length,
        totalRequired: skillTerms.length,
        matchedOptional: 0,
        totalOptional: 0,
        missingSkills: [],
        requiredSkills: [],
        isReal: true,
        applyUrl: aj.redirect_url,
      };
    });

    // Broader jobs = "1-2 skills away" (related but not exact match)
    const gapJobs = broaderJobs.map((aj, i) => {
      const converted = adzunaToInternal(aj, detectVertical(aj));
      return {
        id: `adzuna_gap_${aj.id || i}`,
        title: converted.title,
        employer: converted.employer,
        location: converted.location,
        description: converted.description,
        payMin: converted.payMin,
        payMax: converted.payMax,
        payType: converted.payType,
        shiftType: converted.shiftType,
        vertical: converted.vertical,
        postedAt: new Date(aj.created || Date.now()),
        optionalScore: 0,
        matchedRequired: 0,
        totalRequired: 1,
        matchedOptional: 0,
        totalOptional: 0,
        missingSkills: ["Additional skills may be required"],
        requiredSkills: [],
        isReal: true,
        applyUrl: aj.redirect_url,
      };
    });

    // Caroline's HHA test case showed VP/Director jobs leaking into Tab B
    // with $200+/hr rates. Filter out obvious off-register junk by title.
    // Title keywords that signal C-suite / senior leadership — exclude
    // unless the user's register is already executive.
    const seniorTitle =
      /\b(vice president|vp\b|svp|evp|head of|chief|c[a-z]o\b|director|executive|strategic|transformation)\b/i;

    // Pay-cap per vertical: hourly cents. Caps out off-register noise without
    // blocking legitimate within-vertical premium roles.
    const PAY_CAP_BY_VERTICAL: Record<string, number> = {
      healthcare: 9000, // $90/hr
      food_service: 6000, // $60/hr
      retail: 6000,
      transport: 7000,
      admin: 9000,
      trades: 11000, // $110/hr
      tech: 25000, // $250/hr — tech can legitimately reach this
    };
    const payCap = PAY_CAP_BY_VERTICAL[userVertical] ?? 12000;
    const shouldFilter = userVertical !== "executive" && userVertical !== "other";

    const passesFilter = <T extends { title?: string; payMax?: number }>(j: T) => {
      if (!shouldFilter) return true;
      if (seniorTitle.test(j.title || "")) return false;
      if ((j.payMax || 0) > payCap) return false;
      return true;
    };

    // Sort then filter — splice() to keep TypeScript happy with inferred types
    for (let i = qualifiedJobs.length - 1; i >= 0; i--) {
      if (!passesFilter(qualifiedJobs[i])) qualifiedJobs.splice(i, 1);
    }
    for (let i = gapJobs.length - 1; i >= 0; i--) {
      if (!passesFilter(gapJobs[i])) gapJobs.splice(i, 1);
    }

    // Sort both by pay descending
    qualifiedJobs.sort((a, b) => b.payMax - a.payMax);
    gapJobs.sort((a, b) => b.payMax - a.payMax);

    // Analytics: capture every match request for production debugging.
    // This is what catches future "Marielee got 0 results" bugs automatically.
    void logMatchEvent({
      skillCount: skillTerms.length,
      skills: skillTerms,
      qualifiedCount: qualifiedJobs.length,
      gapCount: gapJobs.length,
      topQualifiedTitles: qualifiedJobs.slice(0, 3).map((j) => j.title),
      topGapTitles: gapJobs.slice(0, 3).map((j) => j.title),
      durationMs: Date.now() - startTime,
      isEmpty: qualifiedJobs.length === 0 && gapJobs.length === 0,
    });

    return NextResponse.json({
      qualifiedJobs,
      gapJobs,
      topGapSkills: [],
      realJobs: [],
      source: "adzuna",
      totalAvailable: qualifiedJobs.length + gapJobs.length,
    });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : "Unknown";
    console.error("Job matching error:", error);
    void logMatchEvent({
      error: errMsg,
      durationMs: Date.now() - startTime,
    });
    return NextResponse.json(
      { error: "Failed to match jobs", detail: errMsg },
      { status: 500 }
    );
  }
}

/**
 * Detect the dominant vertical from the user's skill set — used to filter
 * Adzuna results that match by keyword noise but are off-register.
 */
function detectUserVertical(skills: string[]): string {
  const all = skills.join(" ").toLowerCase();
  if (/care|nurse|patient|elderly|hygiene|medication|cna|hha|caregiv/i.test(all))
    return "healthcare";
  if (/cook|chef|kitchen|food prep|barista|cater|server/i.test(all))
    return "food_service";
  if (/driv|deliver|truck|warehouse|logistics|forklift/i.test(all))
    return "transport";
  if (/cashier|retail|store|merchandis/i.test(all)) return "retail";
  if (/python|javascript|react|sql|engineer|develop|cyber|devops|software/i.test(all))
    return "tech";
  if (/electric|plumb|hvac|weld|carpenter|solar|construct/i.test(all))
    return "trades";
  if (/admin|office|hr|recept|secretar|bookkeep/i.test(all)) return "admin";
  if (/clean|housekeep|janit/i.test(all)) return "healthcare"; // home/care side
  return "other";
}

// Simple vertical detection from job title/category
function detectVertical(job: { title?: string; category?: { tag?: string } }): string {
  const title = (job.title || "").toLowerCase();
  const cat = job.category?.tag || "";

  if (/nurse|health|care|medical|dental|pharma/i.test(title + cat))
    return "healthcare";
  if (/software|developer|engineer|data|cyber|devops|python|java/i.test(title + cat))
    return "tech";
  if (/electric|plumb|hvac|weld|carpenter|solar|construct/i.test(title + cat))
    return "trades";
  if (/admin|office|assistant|secretary|bookkeep|hr/i.test(title + cat))
    return "admin";
  if (/cook|chef|kitchen|food|restaurant|bar|cater/i.test(title + cat))
    return "food_service";
  if (/driver|truck|warehouse|deliver|logistics|transport/i.test(title + cat))
    return "transport";
  if (/retail|sales|store|cashier|merchant/i.test(title + cat))
    return "retail";
  return "other";
}

/* ====================================================================
 * PRESERVED: Old fuzzy matching functions (commented out for future use)
 * ==================================================================== */

// // Fuzzy matching: check if a user skill semantically matches a job skill
// function skillMatches(userTerm: string, jobTerm: string): boolean {
//   const u = userTerm.toLowerCase();
//   const j = jobTerm.toLowerCase();
//   if (u === j) return true;
//   if (u.includes(j) || j.includes(u)) return true;
//   const jobWords = j.split(/\s+/).filter((w) => w.length > 2);
//   const userWords = u.split(/\s+/).filter((w) => w.length > 2);
//   const overlap = jobWords.filter((jw) =>
//     userWords.some((uw) => uw.includes(jw) || jw.includes(uw))
//   );
//   if (jobWords.length > 0 && overlap.length / jobWords.length >= 0.5) return true;
//   const synonyms: Record<string, string[]> = {
//     "meal preparation": ["cooking", "food preparation", "food prep", "cook", "making food", "making meals"],
//     "light housekeeping": ["cleaning", "housework", "tidying", "house cleaning", "housekeeping"],
//     "transportation assistance": ["driving", "transport", "rides", "chauffeur", "driver"],
//     "personal care assistance": ["personal care", "caregiving", "caretaking", "care assistance"],
//     "personal hygiene assistance": ["bathing", "hygiene", "grooming", "dressing assistance"],
//     "companionship": ["companion", "social support", "keeping company", "friendly visiting"],
//     "basic mobility assistance": ["mobility", "walking assistance", "movement help", "mobility support"],
//     "vital signs monitoring": ["blood pressure", "vital signs", "vitals", "temperature check"],
//     "medication reminders": ["medication", "medicine reminders", "pill reminders", "med reminders"],
//     "medication management": ["medication", "medicine management", "med management", "prescriptions"],
//     "cpr certification": ["cpr", "cardiopulmonary", "cpr certified", "cpr/aed"],
//     "first aid": ["first aid", "emergency care", "basic medical"],
//     "documentation": ["paperwork", "record keeping", "charting", "documenting", "reports"],
//     "communication with families": ["family communication", "talking with families", "family liaison"],
//     "dementia care awareness": ["dementia", "alzheimer", "memory care", "cognitive care"],
//     "transfer assistance": ["transfers", "lifting", "patient transfer", "moving patients"],
//     "fall prevention": ["fall risk", "falls", "preventing falls", "balance safety"],
//     "wound care basics": ["wound care", "bandaging", "wound treatment"],
//     "physical therapy assistance": ["physical therapy", "pt assistance", "exercise assistance", "rehab"],
//     "child development basics": ["child care", "child development", "pediatric", "working with children"],
//     "food safety and sanitation": ["food safety", "sanitation", "food hygiene", "kitchen safety"],
//   };
//   for (const [canonical, alts] of Object.entries(synonyms)) {
//     const isJobCanonical = j === canonical || j.includes(canonical);
//     const isUserMatch = alts.some((alt) => u.includes(alt) || alt.includes(u));
//     if (isJobCanonical && isUserMatch) return true;
//     const isUserCanonical = u === canonical || u.includes(canonical);
//     const isJobMatch = alts.some((alt) => j.includes(alt) || alt.includes(j));
//     if (isUserCanonical && isJobMatch) return true;
//   }
//   return false;
// }

// function userHasSkill(userTerms: string[], jobTerm: string): boolean {
//   return userTerms.some((ut) => skillMatches(ut, jobTerm));
// }
