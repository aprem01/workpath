import { NextResponse } from "next/server";
import { searchJobsForSkills, adzunaToInternal } from "@/lib/adzuna";
import { getDomainQueries, getDomainById } from "@/lib/domains";
import {
  classifySkillCluster,
  jobFitsCluster,
  jobPassesCredentials,
  verticalToIndustry,
  findNearestRole,
  findNearestRoleByTitle,
} from "@/lib/taxonomy";
import { getTransferability } from "@/lib/transferability";
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
    const body = await req.json();
    const { userSkills, domainId } = body;
    if (!Array.isArray(userSkills) || userSkills.length === 0) {
      return NextResponse.json(
        { error: "userSkills array is required" },
        { status: 400 }
      );
    }

    // Each incoming skill may carry an industry `context` set by the
    // clarification chip picker on /skills. We track context per-skill
    // so "Management (Logistics)" travels through matching as Logistics,
    // even when the worker's other skills span other industries.
    const skillTerms = userSkills.map(
      (s: { normalizedTerm: string }) => s.normalizedTerm
    );
    const skillsWithContext = userSkills.map(
      (s: { normalizedTerm: string; context?: string }) => ({
        term: s.normalizedTerm,
        context: s.context,
      })
    );

    // ── Caroline's domain anchor (5/22 round-2 fix) ─────────────────
    // If the user picked a primary background on the landing page, use it
    // both for (a) Adzuna search query and (b) vertical filter. This
    // eliminates "Management" skills hallucinating into MD/Escrow jobs.
    const domain = getDomainById(domainId);
    const domainQueries = getDomainQueries(domainId);

    // User vertical: prefer the explicit domain choice over skill inference.
    const userVertical = domain?.vertical || detectUserVertical(skillTerms);

    // ── Cluster classification (Caroline 5/22) ──────────────────────
    // Treat the basket as a coherent unit. A warehouse-manager basket
    // with one stray "Patient Care" skill must not unlock physician
    // jobs. We compute the dominant industry from the basket (biased
    // toward the user's domain anchor) and use it to filter jobs whose
    // vertical disagrees.
    const anchorIndustry = verticalToIndustry(userVertical);
    const cluster = classifySkillCluster(skillTerms, anchorIndustry);

    // ── Nearest TAXONOMY role to the worker's basket (Phase 3) ─────
    // Used to compute per-gap-job transferability scores: "you're 75%
    // of the way from Solar Installer to Elevator Installer". The match
    // API would otherwise hide gap jobs the worker couldn't fully
    // qualify for; transferability lets us surface them as "closer than
    // you think" instead.
    const nearestRole = findNearestRole(skillTerms);

    // Search Adzuna using the domain-curated query (not skill string join).
    const { qualified: exactJobs, broader: broaderJobs } =
      await searchJobsForSkills(skillTerms, "Chicago", 15, domainQueries);

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

    // Compute REAL missing skills per gap job (Caroline 5/22: "Additional
    // skills may be required" was meaningless — show actual orange pills).
    // Strategy: scan the job description for any of the domain's suggested
    // skills that aren't in the user's basket. Those are the gap pills.
    const userSkillSet = new Set(skillTerms.map((s: string) => s.toLowerCase()));
    const domainSuggestedSkills = domain?.suggestedSkills || [];

    const computeMissingSkills = (job: { title: string; description: string }) => {
      const haystack = `${job.title} ${job.description}`.toLowerCase();
      const missing: string[] = [];

      // First pass: skills from the user's domain that are mentioned in the
      // job description but not in the user's basket.
      for (const skill of domainSuggestedSkills) {
        if (missing.length >= 3) break;
        const low = skill.toLowerCase();
        if (userSkillSet.has(low)) continue;
        // Check if the job description mentions this skill or a keyword from it
        const kws = low.split(/[\s/]+/).filter((w) => w.length > 3);
        if (kws.some((k) => haystack.includes(k))) missing.push(skill);
      }

      // Second pass: if domain didn't surface enough, look for certs/keywords
      // commonly required in job postings (license, certification, experience).
      if (missing.length === 0) {
        const CERT_PATTERNS: Array<[RegExp, string]> = [
          [/\bcpr\b|first aid/, "CPR / First Aid"],
          [/cdl\b/, "CDL License"],
          [/osha[- ]?\d+/, "OSHA-10 Certification"],
          [/food[- ]?safety/, "Food Safety Certification"],
          [/forklift/, "Forklift Certification"],
          [/(yardi|leasing agent)/, "Property Mgmt License"],
          [/(2\+|three years|years.{1,10}experience)/, "Years of Experience"],
          [/\bcertified\b|certification/, "Industry Certification"],
        ];
        for (const [re, label] of CERT_PATTERNS) {
          if (re.test(haystack)) {
            missing.push(label);
            if (missing.length >= 2) break;
          }
        }
      }

      return missing.length > 0 ? missing : ["1-2 more skills needed"];
    };

    // Broader jobs = "1-2 skills away" (related but not exact match)
    const gapJobs = broaderJobs.map((aj, i) => {
      const converted = adzunaToInternal(aj, detectVertical(aj));
      const missingSkills = computeMissingSkills({
        title: converted.title,
        description: converted.description,
      });

      // Phase 3 transferability: how close is the worker to this job?
      // Match the job's title to a TAXONOMY role, then look up the
      // edge from the worker's nearest role. Score 0 means we couldn't
      // map the title; that's fine — the UI falls back to the
      // "1-2 skills away" framing.
      const targetRole = findNearestRoleByTitle(converted.title);
      let transferability: {
        score: number;
        percent: number;
        fromRole?: string;
        toRole?: string;
      } | null = null;
      if (nearestRole?.entry.socCode && targetRole?.entry.socCode) {
        const score = getTransferability(
          nearestRole.entry.socCode,
          targetRole.entry.socCode
        );
        if (score > 0) {
          transferability = {
            score,
            percent: Math.round(score * 100),
            fromRole: nearestRole.entry.role,
            toRole: targetRole.entry.role,
          };
        }
      }

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
        totalRequired: missingSkills.length || 1,
        matchedOptional: 0,
        totalOptional: 0,
        missingSkills,
        requiredSkills: [],
        isReal: true,
        applyUrl: aj.redirect_url,
        transferability,
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

    const passesFilter = <
      T extends {
        title?: string;
        description?: string;
        payMax?: number;
        vertical?: string;
      },
    >(
      j: T
    ) => {
      if (!shouldFilter) return true;
      if (seniorTitle.test(j.title || "")) return false;
      if ((j.payMax || 0) > payCap) return false;
      // HARD credential gate. If the job needs an MD / RN / CDL / NMLS /
      // etc. and the user's basket doesn't include it, drop the job. This
      // is the honest, defensible "why hidden": "you don't have that
      // license," not "your cluster looked wrong."
      const credCheck = jobPassesCredentials(
        j.title || "",
        j.description || "",
        skillTerms
      );
      if (!credCheck.passes) return false;
      // Cluster fit (secondary). Drop jobs whose vertical disagrees with
      // the basket's dominant industry when confidence is decent. Below
      // 0.5 we don't enforce — multi-industry baskets stay open.
      if (cluster.confidence >= 0.5 && !jobFitsCluster(j.vertical, cluster)) {
        return false;
      }
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
      clusterIndustry: cluster.industry,
      clusterConfidence: cluster.confidence,
      clusterAffinities: cluster.affinities,
      clusterOutliers: cluster.outliers,
      clusterUnknown: cluster.unknown,
      skillsWithContextCount: skillsWithContext.filter((s) => s.context).length,
      nearestRoleSoc: nearestRole?.entry.socCode || null,
      nearestRoleName: nearestRole?.entry.role || null,
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
