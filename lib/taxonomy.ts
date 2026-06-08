/**
 * ⚑ Canonical seed for the shared matching DB ⚑
 *
 * This file is the EDITABLE source of truth for the Industry > Role >
 * Skill taxonomy. It is mirrored across the PayRanker and Skilmatch
 * repos (kept in sync manually for MVP); the long-form store lives in
 * Neo4j Aura, populated by `scripts/seed-taxonomy-graph.ts`. Both apps
 * point at the same Neo4j instance, so the graph IS the shared DB at
 * runtime — this TS file exists for editability and synchronous
 * React-side lookups (clarification UI) where a network call isn't
 * appropriate.
 *
 * When you change this file:
 *   1. Edit in PayRanker repo (workpath/lib/taxonomy.ts) — that's
 *      the editable copy.
 *   2. Copy to skillmatch/lib/taxonomy.ts.
 *   3. Run `npx tsx scripts/seed-taxonomy-graph.ts` from PayRanker to
 *      push to Neo4j Aura. Idempotent — re-running is safe.
 *
 * ─── Hierarchical skill taxonomy: Industry > Role > Skill. ─────────
 *
 * Caroline 5/22: matching must treat a user's skills as a CLUSTER, not
 * independent atoms. Without this, a basket like ["Operations Management",
 * "Team Leadership", "Customer Service"] can match a Medical Physician
 * job because each token has a weak signal there. The cluster check
 * enforces vertical fit before any job leaks through:
 *
 *   "Someone who has been a Manager in a commercial warehouse does not,
 *    cannot qualify for a Medical Physician job."
 *
 * Structure: an array of (industry, role, skills) triples. Skills can
 * legitimately appear under multiple {industry, role} pairs — that's a
 * feature, not a bug. "Team Leadership" lives in nearly every industry.
 * The classifier rewards skills with NARROW vertical signal more than
 * skills with BROAD signal.
 *
 * This file is the seed dataset; the long tail belongs in Neo4j. The
 * cluster classifier here is the runtime guard the match API calls
 * before returning results.
 */

export interface TaxonomyEntry {
  industry: string;
  role: string;
  skills: string[];
  /**
   * HARD credentials this role legally requires — licenses, board certs,
   * regulator-issued credentials a worker cannot perform the role without.
   * Distinguished from in-skill certs like "OSHA-10" which are policy-based.
   *
   * The match API uses these as an ABSOLUTE gate: if a job needs an
   * RN License and the user doesn't have one, the job is dropped. This is
   * a stricter, more honest guardrail than the cluster-vertical filter —
   * "you don't have an MD" beats "your skills cluster looks like Logistics"
   * as a reason to hide physician jobs.
   */
  credentials?: string[];
}

export const TAXONOMY: TaxonomyEntry[] = [
  // ── Healthcare ────────────────────────────────────────────────────
  {
    industry: "Healthcare",
    role: "Home Health Aide",
    credentials: ["HHA Certification"],
    skills: [
      "Personal Care Assistance",
      "Vital Signs Monitoring",
      "Medication Reminders",
      "Companionship",
      "Elderly Care",
      "CPR / First Aid",
      "HHA Certification",
      "Bathing & Grooming",
      "Mobility Assistance",
      "Dementia Care",
    ],
  },
  {
    industry: "Healthcare",
    role: "Certified Nursing Assistant",
    credentials: ["CNA License"],
    skills: [
      "Patient Care",
      "Vital Signs Monitoring",
      "Bedside Manner",
      "CNA License",
      "EMR Charting",
      "Infection Control",
      "Wound Care",
      "Catheter Care",
    ],
  },
  {
    industry: "Healthcare",
    role: "Medical Assistant",
    skills: [
      "Patient Intake",
      "Phlebotomy",
      "EMR Software",
      "Vital Signs Monitoring",
      "Injection Administration",
      "HIPAA Compliance",
    ],
  },

  // ── Wellness ──────────────────────────────────────────────────────
  {
    industry: "Wellness",
    role: "Massage Therapist",
    credentials: ["Massage Therapy License"],
    skills: [
      "Swedish Massage",
      "Deep Tissue Massage",
      "Hot Stones",
      "Massage Therapy License",
      "Aromatherapy",
      "Sports Massage",
      "Client Intake",
    ],
  },
  {
    industry: "Wellness",
    role: "Personal Trainer",
    skills: [
      "Strength Training",
      "Nutrition Coaching",
      "CPR / First Aid",
      "Personal Training Certification",
      "Program Design",
    ],
  },

  // ── Construction (Commercial + Residential) ───────────────────────
  {
    industry: "Construction",
    role: "General Laborer",
    skills: [
      "Hand & Power Tools",
      "Heavy Lifting",
      "OSHA-10 Certification",
      "Job Site Safety",
      "Material Hauling",
      "Site Cleanup",
    ],
  },
  {
    industry: "Construction",
    role: "Site Foreman",
    skills: [
      "Crew Supervision",
      "Blueprint Reading",
      "OSHA-30 Certification",
      "Team Leadership",
      "Scheduling",
      "Project Coordination",
    ],
  },
  {
    industry: "Construction",
    role: "Electrician",
    credentials: ["Trade License"],
    skills: [
      "Electrical Wiring",
      "Conduit Bending",
      "Electrical Code (NEC)",
      "Troubleshooting",
      "Trade License",
      "Blueprint Reading",
    ],
  },
  {
    industry: "Construction",
    role: "Solar Installer",
    skills: [
      "Solar Panel Installation",
      "Electrical Wiring",
      "Roofing Safety",
      "OSHA-10 Certification",
      "Inverter Setup",
      "Blueprint Reading",
    ],
  },

  // ── Logistics / Transportation / Warehouse ────────────────────────
  {
    industry: "Logistics",
    role: "Warehouse Associate",
    skills: [
      "Forklift Operation",
      "Inventory Management",
      "Shipping & Receiving",
      "OSHA Safety",
      "Pallet Jack Operation",
      "Pick & Pack",
    ],
  },
  {
    industry: "Logistics",
    role: "Warehouse Manager",
    skills: [
      "Team Leadership",
      "Inventory Management",
      "WMS Software",
      "OSHA Safety",
      "Scheduling",
      "Shipping & Receiving",
      "Operations Management",
    ],
  },
  {
    industry: "Logistics",
    role: "Truck Driver",
    credentials: ["CDL License"],
    skills: [
      "CDL License",
      "Route Planning",
      "Vehicle Inspection",
      "DOT Compliance",
      "Logbook Maintenance",
    ],
  },

  // ── Retail / E-Commerce ───────────────────────────────────────────
  {
    industry: "Retail",
    role: "Sales Associate",
    skills: [
      "Customer Service",
      "POS Systems",
      "Cash Handling",
      "Product Knowledge",
      "Visual Merchandising",
      "Loss Prevention",
    ],
  },
  {
    industry: "Retail",
    role: "Store Manager",
    skills: [
      "Team Leadership",
      "Inventory Management",
      "Scheduling",
      "P&L Responsibility",
      "Hiring & Training",
      "Loss Prevention",
    ],
  },
  {
    industry: "Retail",
    role: "Visual Merchandiser",
    skills: [
      "Visual Merchandising",
      "Window Displays",
      "Adobe Creative Suite",
      "Trend Forecasting",
      "Planogram Execution",
    ],
  },

  // ── Hospitality / Food Service ────────────────────────────────────
  {
    industry: "Hospitality",
    role: "Server",
    skills: [
      "Customer Service",
      "POS Systems",
      "Food Safety",
      "Wine Knowledge",
      "Multitasking",
      "Cash Handling",
    ],
  },
  {
    industry: "Hospitality",
    role: "Line Cook",
    skills: [
      "Food Preparation",
      "Knife Skills",
      "Food Safety",
      "ServSafe Certification",
      "Grill Station",
      "Sauté Station",
    ],
  },
  {
    industry: "Hospitality",
    role: "Hotel Front Desk",
    skills: [
      "Guest Services",
      "Reservation Systems",
      "Conflict Resolution",
      "Concierge",
      "Cash Handling",
    ],
  },

  // ── Administrative / Office ───────────────────────────────────────
  {
    industry: "Administrative",
    role: "Office Coordinator",
    skills: [
      "Microsoft Office",
      "Scheduling",
      "Email Management",
      "Filing & Records",
      "Phone Etiquette",
    ],
  },
  {
    industry: "Administrative",
    role: "Executive Assistant",
    skills: [
      "Calendar Management",
      "Travel Coordination",
      "Expense Reports",
      "Microsoft Office",
      "Confidentiality",
      "Stakeholder Communication",
    ],
  },
  {
    industry: "Administrative",
    role: "Customer Service Representative",
    skills: [
      "Phone Etiquette",
      "Conflict Resolution",
      "CRM Software",
      "Data Entry",
      "Multitasking",
      "Customer Service",
    ],
  },

  // ── Technology / IT ───────────────────────────────────────────────
  {
    industry: "Technology",
    role: "Software Engineer",
    skills: [
      "JavaScript",
      "TypeScript",
      "React",
      "Node.js",
      "SQL",
      "Git",
      "REST APIs",
      "System Design",
    ],
  },
  {
    industry: "Technology",
    role: "Programmer",
    skills: [
      "Python",
      "Script Writing",
      "Bash Scripting",
      "Automation",
      "Debugging",
      "Git",
    ],
  },
  {
    industry: "Technology",
    role: "IT Support",
    skills: [
      "Technical Troubleshooting",
      "Windows Support",
      "macOS Support",
      "Networking Basics",
      "Ticketing Systems",
      "Hardware Setup",
    ],
  },
  {
    industry: "Technology",
    role: "Product Designer",
    skills: [
      "Figma",
      "Design Systems",
      "User Research",
      "Prototyping",
      "Accessibility",
      "Wireframing",
    ],
  },

  // ── Manufacturing ─────────────────────────────────────────────────
  {
    industry: "Manufacturing",
    role: "Machine Operator",
    skills: [
      "Machine Operation",
      "Quality Control",
      "Assembly Line Work",
      "Lean Manufacturing",
      "Safety Compliance",
      "Blueprint Reading",
    ],
  },
  {
    industry: "Manufacturing",
    role: "Quality Inspector",
    skills: [
      "Quality Control",
      "Inspection Standards",
      "Statistical Process Control",
      "Calipers & Micrometers",
      "ISO 9001",
    ],
  },

  // ── Automotive ────────────────────────────────────────────────────
  {
    industry: "Automotive",
    role: "Auto Mechanic",
    skills: [
      "Engine Diagnostics",
      "Brake Repair",
      "Transmission Service",
      "ASE Certification",
      "OBD-II Scanning",
      "Suspension & Alignment",
      "Hand & Power Tools",
    ],
  },
  {
    industry: "Automotive",
    role: "Auto Body Technician",
    skills: [
      "Collision Repair",
      "Frame Straightening",
      "Auto Painting",
      "Welding",
      "Dent Removal",
      "ICAR Certification",
    ],
  },
  {
    industry: "Automotive",
    role: "Service Advisor",
    skills: [
      "Customer Service",
      "Service Writing",
      "Estimating",
      "Dealership Management System",
      "Upselling",
    ],
  },
  {
    industry: "Automotive",
    role: "Parts Specialist",
    skills: [
      "Parts Catalog Lookup",
      "Inventory Management",
      "Customer Service",
      "Shipping & Receiving",
    ],
  },

  // ── Finance ───────────────────────────────────────────────────────
  {
    industry: "Finance",
    role: "Bookkeeper",
    skills: [
      "QuickBooks",
      "Accounts Payable",
      "Accounts Receivable",
      "Bank Reconciliation",
      "Excel",
      "Payroll Processing",
    ],
  },
  {
    industry: "Finance",
    role: "Accountant",
    credentials: ["CPA License"],
    skills: [
      "GAAP",
      "Financial Statements",
      "Tax Preparation",
      "CPA License",
      "Audit Support",
      "QuickBooks",
      "Excel",
    ],
  },
  {
    industry: "Finance",
    role: "Financial Analyst",
    skills: [
      "Financial Modeling",
      "Excel",
      "Forecasting",
      "Variance Analysis",
      "SQL",
      "Power BI",
    ],
  },
  {
    industry: "Finance",
    role: "Loan Officer",
    credentials: ["NMLS License"],
    skills: [
      "Mortgage Origination",
      "Underwriting",
      "Credit Analysis",
      "NMLS License",
      "Customer Service",
      "Compliance",
    ],
  },
  {
    industry: "Finance",
    role: "Bank Teller",
    skills: [
      "Cash Handling",
      "Customer Service",
      "Transaction Processing",
      "Fraud Detection",
      "Cross-Selling",
    ],
  },

  // ── Marketing ─────────────────────────────────────────────────────
  {
    industry: "Marketing",
    role: "Digital Marketing Specialist",
    skills: [
      "Google Ads",
      "Meta Ads",
      "SEO",
      "Google Analytics",
      "Email Marketing",
      "Conversion Tracking",
      "A/B Testing",
    ],
  },
  {
    industry: "Marketing",
    role: "Social Media Manager",
    skills: [
      "Content Calendar",
      "Instagram Strategy",
      "TikTok Strategy",
      "Community Management",
      "Copywriting",
      "Influencer Outreach",
    ],
  },
  {
    industry: "Marketing",
    role: "Content Marketer",
    skills: [
      "Copywriting",
      "SEO",
      "Editorial Calendar",
      "CMS Software",
      "Email Marketing",
      "Brand Voice",
    ],
  },
  {
    industry: "Marketing",
    role: "Brand Manager",
    skills: [
      "Brand Strategy",
      "Market Research",
      "Creative Direction",
      "Campaign Management",
      "Stakeholder Communication",
      "P&L Responsibility",
    ],
  },
  {
    industry: "Marketing",
    role: "Email Marketing Specialist",
    skills: [
      "Email Marketing",
      "Mailchimp",
      "Klaviyo",
      "Segmentation",
      "Deliverability",
      "Copywriting",
      "A/B Testing",
    ],
  },

  // ── Education ─────────────────────────────────────────────────────
  {
    industry: "Education",
    role: "Teacher's Aide",
    skills: [
      "Classroom Management",
      "Child Development",
      "Patience & Empathy",
      "Lesson Support",
      "Communication with Parents",
    ],
  },
  {
    industry: "Education",
    role: "Tutor",
    skills: [
      "Subject Expertise",
      "Lesson Planning",
      "Patience & Empathy",
      "Student Assessment",
    ],
  },
];

// ─── Reverse index: skill (lowercased) → set of industries it appears in ─
const SKILL_INDEX: Map<string, Set<string>> = (() => {
  const map = new Map<string, Set<string>>();
  for (const entry of TAXONOMY) {
    for (const skill of entry.skills) {
      const key = skill.toLowerCase();
      if (!map.has(key)) map.set(key, new Set());
      map.get(key)!.add(entry.industry);
    }
  }
  return map;
})();

// Inverse-document-frequency-ish weight: skills appearing in many industries
// (e.g. "Team Leadership") get a low specificity score; skills appearing in
// one industry (e.g. "Solar Panel Installation") get high specificity. We
// use this to weight the cluster vote so generic skills can't dominate.
function skillSpecificity(skill: string): number {
  const industries = SKILL_INDEX.get(skill.toLowerCase());
  if (!industries || industries.size === 0) return 0;
  return 1 / industries.size;
}

export interface ClusterResult {
  /** Industry that most of the basket maps to. Null if no skill is recognized. */
  industry: string | null;
  /** All industries the basket touched, with their specificity-weighted score. */
  industryScores: { industry: string; score: number }[];
  /**
   * Industry affinities as percentages (0..1) of total signal. Sums to 1
   * across reported industries. Use this when the basket genuinely spans
   * multiple industries — a Hospitality + Travel + Luxury Retail worker
   * should see jobs from all three, not get force-bucketed into one.
   *
   * Only includes industries with ≥ 5% signal so the list stays useful.
   */
  affinities: { industry: string; percent: number }[];
  /** Skills that don't fit the dominant industry. */
  outliers: string[];
  /** Skills not found in the taxonomy at all. */
  unknown: string[];
  /** 0..1. How concentrated the cluster is — 1 means every skill points to one industry. */
  confidence: number;
}

/**
 * Classify a basket of skills into a dominant industry.
 *
 * @param skills user's skill terms (normalized form preferred)
 * @param anchorIndustry optional: when the user already picked a domain, we
 *   bias toward it (Caroline 5/22: the explicit domain is the strongest
 *   signal we have; cluster check should reinforce, not override it).
 */
export function classifySkillCluster(
  skills: string[],
  anchorIndustry?: string | null
): ClusterResult {
  const scores = new Map<string, number>();
  const unknown: string[] = [];

  for (const raw of skills) {
    const industries = SKILL_INDEX.get(raw.toLowerCase());
    if (!industries || industries.size === 0) {
      unknown.push(raw);
      continue;
    }
    const weight = skillSpecificity(raw);
    industries.forEach((ind) => {
      scores.set(ind, (scores.get(ind) || 0) + weight);
    });
  }

  // Anchor bias: give the user's selected domain a small bump so a single
  // generic skill in another industry can't outweigh the explicit pick.
  if (anchorIndustry) {
    scores.set(anchorIndustry, (scores.get(anchorIndustry) || 0) + 0.5);
  }

  const sorted = Array.from(scores.entries())
    .map(([industry, score]) => ({ industry, score }))
    .sort((a, b) => b.score - a.score);

  const industry = sorted[0]?.industry ?? null;
  const total = sorted.reduce((s, x) => s + x.score, 0);
  const confidence = total > 0 && industry ? (sorted[0].score / total) : 0;

  // Affinities: same scores reframed as percentages. Drop any below 5% so
  // the list reads cleanly. Reflects the multi-industry reality of real
  // careers (e.g. Hospitality 40% / Travel 35% / Luxury Retail 25%).
  const affinities =
    total > 0
      ? sorted
          .map((x) => ({ industry: x.industry, percent: x.score / total }))
          .filter((a) => a.percent >= 0.05)
      : [];

  // Outliers: skills whose industry-set doesn't include the dominant one.
  const outliers: string[] = [];
  if (industry) {
    for (const raw of skills) {
      const industries = SKILL_INDEX.get(raw.toLowerCase());
      if (!industries || industries.size === 0) continue;
      if (!industries.has(industry)) outliers.push(raw);
    }
  }

  return {
    industry,
    industryScores: sorted,
    affinities,
    outliers,
    unknown,
    confidence,
  };
}

/**
 * Map a job's vertical/category string onto a taxonomy industry. The match
 * API uses this to drop jobs whose vertical doesn't fit the basket's
 * dominant industry — that's the core Caroline-5/22 guardrail.
 */
const VERTICAL_TO_INDUSTRY: Record<string, string> = {
  healthcare: "Healthcare",
  wellness: "Wellness",
  trades: "Construction",
  construction: "Construction",
  manufacturing: "Manufacturing",
  transport: "Logistics",
  logistics: "Logistics",
  retail: "Retail",
  food_service: "Hospitality",
  hospitality: "Hospitality",
  admin: "Administrative",
  administrative: "Administrative",
  tech: "Technology",
  technology: "Technology",
  education: "Education",
  automotive: "Automotive",
  finance: "Finance",
  banking: "Finance",
  accounting: "Finance",
  marketing: "Marketing",
  advertising: "Marketing",
};

export function verticalToIndustry(vertical: string | null | undefined): string | null {
  if (!vertical) return null;
  return VERTICAL_TO_INDUSTRY[vertical.toLowerCase()] ?? null;
}

/**
 * Industries this single skill belongs to. Used by the per-skill
 * clarification UI: if a skill lives in 2+ industries AND the user's
 * anchor isn't one of them, prompt for clarification before adding it
 * to the basket. Caroline 5/22 sketch: "if skill is ambiguous AI
 * requests the industry clarification".
 */
export function getSkillIndustries(skill: string): string[] {
  const industries = SKILL_INDEX.get(skill.toLowerCase());
  return industries ? Array.from(industries) : [];
}

/**
 * Should we prompt for clarification when this skill is being added to
 * a basket anchored to `anchorIndustry`?
 *
 * Returns the candidate industries when:
 *  - the skill is known to the taxonomy AND
 *  - it lives in 2+ industries AND
 *  - the anchor (if any) is NOT one of them — meaning the anchor
 *    can't resolve the ambiguity for free.
 *
 * Returns null when no prompt is needed (skill is unambiguous, or the
 * anchor already disambiguates it, or we have no signal at all).
 */
export function needsIndustryClarification(
  skill: string,
  anchorIndustry?: string | null
): string[] | null {
  const industries = getSkillIndustries(skill);
  if (industries.length < 2) return null;
  if (anchorIndustry && industries.includes(anchorIndustry)) return null;
  return industries;
}

/**
 * Does a job's vertical fit the dominant industry of a skill cluster?
 *
 * Returns true when:
 *  - the job has no resolvable industry (we don't block on unknowns), OR
 *  - the cluster has no resolvable industry (same reason), OR
 *  - the two industries match.
 *
 * Returns false ONLY when both sides are confidently classified and they
 * disagree — the warehouse-manager → physician case.
 */
export function jobFitsCluster(
  jobVertical: string | null | undefined,
  cluster: ClusterResult
): boolean {
  const jobIndustry = verticalToIndustry(jobVertical);
  if (!jobIndustry) return true;
  if (!cluster.industry) return true;
  return jobIndustry === cluster.industry;
}

// ─── Credential gates ─────────────────────────────────────────────
//
// The honest guardrail. Cross-vertical filtering is a *proxy* for
// "you don't have the credential this job requires." Credentials are
// the underlying truth: an MD job needs an MD license, an HHA job
// needs HHA certification, a truck driver needs a CDL. When we drop
// a job, we should be able to point at exactly the credential that
// caused it.
//
// Detection runs over the job title + description (Adzuna gives us
// both). A credential is required if its regex matches the posting.
// The user "has" a credential if a matching token is in their skill
// basket. Cheap, deterministic, easy to explain.

interface CredentialPattern {
  /** The canonical credential label we'd recognise in a skill basket. */
  label: string;
  /** Regex against `${title} ${description}`.toLowerCase(). */
  jobPattern: RegExp;
  /** Aliases the user might have entered; matched case-insensitive. */
  userAliases: string[];
}

const CREDENTIAL_PATTERNS: CredentialPattern[] = [
  // Healthcare
  {
    label: "MD License",
    jobPattern: /\b(physician|md\b|medical doctor|attending\b|surgeon|psychiatrist|cardiologist|oncologist|radiologist)\b/,
    userAliases: ["md license", "md", "medical doctor", "physician license"],
  },
  {
    label: "RN License",
    jobPattern: /\b(registered nurse|rn\b)\b/,
    userAliases: ["rn license", "rn", "registered nurse license"],
  },
  {
    label: "LPN License",
    jobPattern: /\b(licensed practical nurse|lpn\b|lvn\b|licensed vocational nurse)\b/,
    userAliases: ["lpn license", "lpn", "lvn", "licensed practical nurse license"],
  },
  {
    label: "NP License",
    jobPattern: /\b(nurse practitioner|np\b)\b/,
    userAliases: ["np license", "nurse practitioner license"],
  },
  {
    label: "PT License",
    jobPattern: /\b(physical therapist|pt\b)\b/,
    userAliases: ["pt license", "physical therapist license", "dpt"],
  },
  {
    label: "OT License",
    jobPattern: /\b(occupational therapist|otr\b)\b/,
    userAliases: ["ot license", "occupational therapist license", "otr"],
  },
  {
    label: "CNA License",
    jobPattern: /\b(cna\b|certified nursing assistant)\b/,
    userAliases: ["cna license", "cna", "certified nursing assistant"],
  },
  {
    label: "HHA Certification",
    jobPattern: /\b(hha\b|home health aide)\b/,
    userAliases: ["hha certification", "hha", "home health aide certification"],
  },
  // Wellness
  {
    label: "Massage Therapy License",
    jobPattern: /\b(licensed massage therapist|lmt\b|massage therapist)\b/,
    userAliases: ["massage therapy license", "lmt", "massage license"],
  },
  // Logistics
  {
    label: "CDL License",
    jobPattern: /\b(cdl\b|class a driver|class b driver|commercial drivers? license)\b/,
    userAliases: ["cdl license", "cdl", "cdl-a", "cdl-b", "class a", "class b"],
  },
  // Finance
  {
    label: "CPA License",
    jobPattern: /\b(cpa\b|certified public accountant)\b/,
    userAliases: ["cpa license", "cpa", "certified public accountant"],
  },
  {
    label: "NMLS License",
    jobPattern: /\b(nmls\b|licensed mortgage|mortgage loan originator|mlo\b)\b/,
    userAliases: ["nmls license", "nmls", "mortgage license"],
  },
  // Construction trades
  {
    label: "Trade License",
    jobPattern: /\b(journeyman|master electrician|licensed electrician|licensed plumber|master plumber)\b/,
    userAliases: ["trade license", "journeyman license", "electrical license", "plumbing license"],
  },
];

/**
 * Which hard credentials does this job posting require?
 * Scans title + description for credential keywords.
 */
export function detectJobCredentials(jobTitle: string, jobDescription: string): string[] {
  const haystack = `${jobTitle || ""} ${jobDescription || ""}`.toLowerCase();
  const found: string[] = [];
  for (const cred of CREDENTIAL_PATTERNS) {
    if (cred.jobPattern.test(haystack)) found.push(cred.label);
  }
  return found;
}

/**
 * Does the user's basket cover a given credential?
 * Case-insensitive substring match against every alias.
 */
export function userHasCredential(
  userSkills: string[],
  credential: string
): boolean {
  const pattern = CREDENTIAL_PATTERNS.find((c) => c.label === credential);
  if (!pattern) return false;
  const lower = userSkills.map((s) => s.toLowerCase());
  return pattern.userAliases.some((alias) =>
    lower.some((s) => s.includes(alias))
  );
}

/**
 * The credential gate. Returns true when the user satisfies every credential
 * the job requires. Returns false ONLY when a required credential is missing
 * from the user's basket — that's an honest reason to hide the job.
 */
export function jobPassesCredentials(
  jobTitle: string,
  jobDescription: string,
  userSkills: string[]
): { passes: boolean; missingCredentials: string[] } {
  const required = detectJobCredentials(jobTitle, jobDescription);
  if (required.length === 0) return { passes: true, missingCredentials: [] };
  const missing = required.filter((c) => !userHasCredential(userSkills, c));
  return { passes: missing.length === 0, missingCredentials: missing };
}
