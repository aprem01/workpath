/**
 * Prohibited-activity screening — shared between PayRanker and Skilmatch.
 *
 * Caroline 9/9 re-test: the previous build over-blocked. "Registered Nurse",
 * "Logistics", "Legal counsel", "Forensic chemist" and "Human Trafficking
 * Prevention Specialist" all returned "We couldn't verify … right now" —
 * that string is the AI-classifier ERROR fallback, not a real verdict. A
 * transient Anthropic outage turned every benign input into a dead end,
 * and because clarification re-ran through the same failing path the user
 * could never escape the loop.
 *
 * Caroline's three states, now implemented literally:
 *   🟢 allow    — legitimate; accept and match.
 *   🟠 clarify  — genuinely ambiguous; ask ONE question.
 *   🔴 block    — prohibited; refuse, generate nothing.
 *
 * Ordering (each layer can only tighten, never silently widen):
 *   L0  normalizeForMatching   strip leetspeak / spacing / punctuation.
 *   L1  fastPathBlock          unambiguous illicit phrases.
 *   L1b protective override    a fastpath hit on a PROTECTIVE phrase
 *                              ("…Prevention Specialist") is not an
 *                              auto-block and not an auto-allow — it goes
 *                              to the AI, which is told a respectable
 *                              suffix does not launder an illicit noun.
 *   L2  known-legitimate       exact/near match on a common occupation →
 *                              allow WITHOUT an AI call. Cheap and immune
 *                              to classifier outages.
 *   L3  AI classifier          sees the input WITH the cumulative basket.
 *
 * Outage policy (the fix for Caroline's loop): the classifier retries,
 * then degrades by RISK rather than defaulting to clarify for everything.
 * An input carrying no sensitive-topic signal at all is allowed — our
 * outage must not block somebody's legitimate work. Only inputs that do
 * carry sensitive signal are held, and they say so honestly.
 */

import Anthropic from "@anthropic-ai/sdk";

export type SafetyVerdict = "allow" | "clarify" | "block";

export interface SafetyResult {
  verdict: SafetyVerdict;
  /** Internal reason. Never surfaced verbatim to end users. */
  reason: string;
  layer: "legitimate" | "protective" | "fastpath" | "ai" | "degraded";
  /** For "clarify": a neutral question to show the user. */
  clarifyPrompt?: string;
}

// ─── L0: obfuscation normalizer ────────────────────────────────────
const LEET: Record<string, string> = {
  "0": "o", "1": "i", "3": "e", "4": "a", "5": "s",
  "7": "t", "@": "a", "$": "s", "!": "i", "|": "l",
};

export function normalizeForMatching(input: string): string {
  let s = input.toLowerCase();
  s = s.replace(/[0134578@$!|]/g, (c) => LEET[c] ?? c);
  s = s.replace(/(?<=\w)[*.\-_](?=\w)/g, "");
  // "p i m p" — collapse ONLY when every token is a single char.
  s = s.replace(/\b(?:\w\s){2,}\w\b/g, (m) => m.replace(/\s/g, ""));
  return s.replace(/\s+/g, " ").trim();
}

// ─── Sensitive-topic + protective markers ──────────────────────────
const SENSITIVE_TOPICS =
  /\b(traffick\w*|narcotic\w*|drug\w*|substance\w*|addiction|sex\w*|adult|porn\w*|child\w*|pimp\w*|prostitut\w*|gambl\w*|fraud|launder\w*|weapon\w*|firearm\w*|violence|abuse|exploitation|escort|discreet|unlicensed|illicit|illegal|black.?market|underground)\b/i;

const PROTECTIVE_MARKERS =
  /\b(prevention|prevent|counsel(or|ing)|therap(ist|y)|rehab(ilitation)?|recovery|treatment|educator|education|instructor|teacher|trainer|researcher|research|academic|scholar|professor|investigator|investigation|detective|enforcement|officer|prosecutor|attorney|lawyer|advocate|advocacy|survivor|victim|support\s+specialist|social\s+worker|case\s+manager|outreach|awareness|harm\s+reduction|nurse|pharmacist|pharmacy\s+technician|forensic|crime\s+scene|analyst|compliance|audit(or)?|regulator|inspector|policy)\b/i;

/** Does this input carry ANY sensitive signal? Drives the outage policy. */
export function hasSensitiveSignal(input: string): boolean {
  return SENSITIVE_TOPICS.test(normalizeForMatching(input));
}

function hasProtectiveMarker(input: string): boolean {
  return PROTECTIVE_MARKERS.test(normalizeForMatching(input));
}

// ─── L1: fast-path hard blocks ─────────────────────────────────────
const FASTPATH_BLOCK: RegExp[] = [
  /\b(drug|narcotics?|cocaine|meth|heroin|fentanyl|opioids?|crack|weed|marijuana)\s+(deal(er|ing)?|traffick(er|ing)?|sell(er|ing)?|distribut(or|ion)|push(er|ing)?|runner|mule)\b/,
  /\b(sell(ing)?|deal(ing)?|push(ing)?|distribut(e|ing))\s+(drugs?|narcotics?|cocaine|meth|heroin|fentanyl|opioids?|crack|pills?)\b/,
  /\bdrug\s+(trafficker|lord|kingpin|cartel)\b/,
  /\b(controlled\s+substance|narcotics?)\s+(distribution|distributor|sales?|dealer)\b/,
  /\b(underground|black[\s-]?market|illegal|illicit|unlicensed|off[\s-]the[\s-]books)\s+(pharmac\w*|pharmaceutical\w*|drug\w*|substance\w*|medication\w*|goods?|courier|logistics)\b/,
  /\b(human|sex|child|labor|organ)\s+traffick(er|ing)\b/,
  /\bchild\s+(exploitation|porn\w*|abuse\s+material|sex\w*)\b/,
  /\bcommercial\s+sex(ual)?\s+(work(er)?|recruit\w*|exploitation)\b/,
  /\bpimp(s|ing|ed)?\b/,
  /\bprostitut(e|es|ion|ing)\b/,
  /\bbrothel\b/,
  /\bescort\s+(service|agency|business|operator)\b/,
  /\bsex\s+work(er)?\b/,
  /\b(whor\w*|hooker\w*|streetwalk\w*)\b/,
  /\bhit\s*(man|men|woman|women|person)\b/,
  /\bcontract\s+kill(er|ing)\b/,
  /\bmurder\s+for\s+hire\b/,
  /\bassassin(ate|ation)?\b/,
  /\bmoney\s+launder(er|ing)\b/,
  /\bracket(eer(ing)?)?\b/,
  /\b(fraud|scam|ponzi|pyramid)\s+scheme\b/,
  /\bmoney\s+mule\b/,
  /\bidentity\s+the(ft|if)\b/,
  /\b(counterfeit|stolen)\s+goods?\s+(seller|dealer|distributor|fence)\b/,
  /\bforge(r|ry)\b/,
  /\billegal\s+(arms?|weapons?|firearms?)\s+(deal\w*|traffick\w*|sales?)\b/,
  /\barms?\s+traffick\w*\b/,
  /\billegal\s+gambling\b/,
  /\bporn\s+(videographer|photographer|producer|director|actor|actress)\b/,
];

export function fastPathBlock(input: string): string | null {
  const n = normalizeForMatching(input);
  for (const rx of FASTPATH_BLOCK) if (rx.test(n)) return rx.source;
  return null;
}

// ─── L2: known-legitimate occupations ──────────────────────────────
// Caroline 9/9: these must never depend on an AI round-trip. Matching is
// on the whole normalized string (optionally with a leading seniority or
// trailing specialisation), so "pimp counselor" can never satisfy it —
// the phrase has to BE the occupation, not merely contain one.
const LEGITIMATE_OCCUPATIONS = [
  // Caroline's exact re-test cases
  "registered nurse", "legal counsel", "forensic chemist", "logistics",
  "human trafficking prevention specialist",
  // Healthcare
  "nurse", "licensed practical nurse", "nurse practitioner", "physician",
  "medical assistant", "certified nursing assistant", "home health aide",
  "personal care aide", "caregiver", "caregiving", "phlebotomist",
  "pharmacist", "pharmacy technician", "physical therapist",
  "occupational therapist", "respiratory therapist", "radiologic technologist",
  "dental hygienist", "paramedic", "emergency medical technician",
  "addiction counselor", "substance abuse counselor", "mental health counselor",
  "social worker", "case manager", "patient care technician", "medical coder",
  "hospice aide", "dialysis technician", "surgical technologist",
  // Legal / public safety
  "attorney", "lawyer", "paralegal", "legal assistant", "compliance officer",
  "police officer", "detective", "forensic scientist", "forensic analyst",
  "crime scene investigator", "crime scene photographer",
  "narcotics investigator", "probation officer", "security guard",
  "loss prevention specialist", "fraud analyst", "fraud investigator",
  // Education / research
  "teacher", "instructor", "professor", "researcher", "research assistant",
  "adult education instructor", "sexual health educator", "school counselor",
  "librarian", "tutor", "curriculum developer",
  // Trades / industrial
  "electrician", "plumber", "carpenter", "welder", "machinist", "hvac technician",
  "maintenance technician", "construction worker", "general contractor",
  "roofer", "painter", "landscaper", "solar installer",
  // Transport / logistics
  "truck driver", "delivery driver", "courier", "dispatcher", "warehouse associate",
  "forklift operator", "logistics coordinator", "supply chain analyst",
  "logistics manager", "fleet manager", "shipping clerk",
  // Retail / hospitality / food
  "sales associate", "retail sales associate", "cashier", "store manager",
  "visual merchandiser", "customer service representative", "bartender",
  "server", "line cook", "chef", "sous chef", "kitchen manager", "barista",
  "housekeeper", "front desk agent", "concierge", "event coordinator",
  // Office / professional
  "administrative assistant", "executive assistant", "receptionist",
  "bookkeeper", "accountant", "auditor", "financial analyst", "recruiter",
  "human resources specialist", "project manager", "operations manager",
  "office manager", "data analyst", "business analyst",
  // Tech / creative
  "software engineer", "web developer", "data scientist", "product manager",
  "ux designer", "graphic designer", "it support specialist",
  "systems administrator", "network engineer", "qa engineer",
  "technical writer", "copywriter", "photographer", "videographer",
  "marketing manager", "social media manager",
];

const LEGIT_SET = new Set(LEGITIMATE_OCCUPATIONS);
// Leading seniority words and trailing specialisations we tolerate, e.g.
// "senior logistics", "registered nurse — icu".
const SENIORITY_PREFIX =
  /^(senior|junior|lead|head|chief|principal|staff|associate|assistant|entry[\s-]?level|certified|licensed|registered)\s+/;

export function isKnownLegitimate(input: string): boolean {
  let n = normalizeForMatching(input).replace(/[.,;:]+$/, "");
  if (LEGIT_SET.has(n)) return true;
  // Strip a trailing specialisation after a dash/slash/parenthesis:
  // "registered nurse — icu" → "registered nurse".
  const base = n.split(/\s*[—–\-\/(]\s*/)[0].trim();
  if (LEGIT_SET.has(base)) return true;
  // Strip one leading seniority word and retry.
  if (SENIORITY_PREFIX.test(n)) {
    const stripped = n.replace(SENIORITY_PREFIX, "").trim();
    if (LEGIT_SET.has(stripped)) return true;
    if (LEGIT_SET.has(stripped.split(/\s*[—–\-\/(]\s*/)[0].trim())) return true;
  }
  if (SENIORITY_PREFIX.test(base)) {
    n = base.replace(SENIORITY_PREFIX, "").trim();
    if (LEGIT_SET.has(n)) return true;
  }
  return false;
}

// ─── L3: AI contextual classifier ─────────────────────────────────
const client = new Anthropic();

async function callClassifier(opts: {
  input: string;
  context?: string[];
  surface: "jobseeker_skill" | "employer_role" | "employer_skill";
  model?: string;
}): Promise<SafetyResult> {
  const ctx = (opts.context || []).filter(Boolean);
  const surfaceDesc =
    opts.surface === "employer_role"
      ? "an EMPLOYER is entering a job role/title they want to hire for"
      : opts.surface === "employer_skill"
        ? "an EMPLOYER is entering a required/optional skill for a job posting"
        : "a JOBSEEKER is entering a skill they have";

  const prompt = `You are the safety classifier for a legitimate job-matching platform. ${surfaceDesc}.

INPUT: "${opts.input}"
${ctx.length ? `SURROUNDING CONTEXT (other items already entered): ${ctx.map((c) => `"${c}"`).join(", ")}` : "SURROUNDING CONTEXT: (none yet)"}

Return ONLY valid JSON:
{ "verdict": "allow" | "clarify" | "block", "reason": "<one sentence>", "clarifyPrompt": "<only for clarify — a short neutral question>" }

DEFAULT TO ALLOW. Most inputs are ordinary work. Only depart from allow
when there is a concrete reason in the text itself.

BLOCK when the input clearly describes illegal activity or illegal
employment, including when disguised:
- Drug dealing / trafficking / distribution of controlled substances
  ("independent recreational product distributor", "cash-only substances",
  "no-questions-asked delivery", "unlicensed medication supplier").
- Human / sex / child trafficking; procurement of sex work
  ("adult-services manager", "private services to paying clients",
  "recruit young women for an adult business").
- Violence for hire, weapons trafficking, money laundering, fraud
  schemes, counterfeit / stolen goods trade, identity theft.
- Production or distribution of child sexual abuse material.

A protective or professional word bolted onto an illicit activity does
NOT launder it. "Pimp counselor", "drug dealer researcher", "hitman
trainer", "cocaine distribution analyst" → BLOCK. Ask: is the person
doing the illegal act, or working against it?

ALLOW legitimate occupations even when they contain sensitive words.
Roles whose PURPOSE is to prevent, treat, investigate, prosecute,
educate about, or protect from an illicit activity are legitimate:
Human Trafficking Prevention Specialist, Addiction Counselor, Substance
Abuse Counselor, Sexual Health Educator, Sexual Assault Counselor, Adult
Education Instructor, academic researcher of pornography, Forensic /
Crime Scene Photographer, Forensic Chemist, Child Protection Social
Worker, Narcotics Investigator, Drug Rehabilitation Counselor,
Pharmacist, Harm Reduction Worker, Legal Counsel (a lawyer — including
one whose clients are criminals; defending or advising an offender is
lawful work), Adult Entertainment Manager (absent coercion signals),
Companion / Home Companion / In-Home Companion (elder care), Logistics,
Delivery Driver, Courier, Bartender, Cannabis Dispensary Associate.

IMPORTANT — clarification must be able to RESOLVE. If the user has
supplied a description that identifies a lawful occupation, ALLOW it.
Examples that must allow:
- "I am a lawyer and I give legal counsel to pimps in jail" → allow
  (criminal defence is lawful).
- "As a forensic researcher I study drug dealers" → allow (research).
- "Legal counsel", "Forensic chemist", "Registered Nurse", "Logistics"
  → allow, plainly.
Never return clarify twice for the same underlying occupation once it
has been described in lawful terms.

CLARIFY only when the text is genuinely ambiguous AND the context does
not resolve it — or when an individually innocuous input sits in a
basket that points toward illicit intent:
- "Discreet Delivery" → clarify (alone or with Logistics + Driving +
  Cash Handling).
- "Adult Client Services" → clarify.
- "Companionship Services" / "Private Companionship" with NO context →
  clarify. But "Companionship" / "Companion" when the basket contains
  caregiving, elder care, home health, HHA, meal preparation or personal
  care → ALLOW; it is a standard Home Health Aide skill.
Ordinary skills must not wash out a suspicious one: judge the basket as
a whole.`;

  const msg = await client.messages.create({
    model: opts.model || "claude-haiku-4-5-20251001",
    max_tokens: 300,
    messages: [{ role: "user", content: prompt }],
  });
  let text = (msg.content[0] as { type: string; text: string }).text || "";
  text = text.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
  const parsed = JSON.parse(text) as Partial<SafetyResult>;
  const verdict: SafetyVerdict =
    parsed.verdict === "block" || parsed.verdict === "clarify" || parsed.verdict === "allow"
      ? parsed.verdict
      : "allow"; // unparseable + already past fastpath → treat as ordinary
  return {
    verdict,
    reason: parsed.reason || "classifier",
    layer: "ai",
    clarifyPrompt:
      verdict === "clarify"
        ? parsed.clarifyPrompt ||
          `Can you describe the work you do as "${opts.input}"?`
        : undefined,
  };
}

export async function classifySafetyWithAI(opts: {
  input: string;
  context?: string[];
  surface: "jobseeker_skill" | "employer_role" | "employer_skill";
  model?: string;
}): Promise<SafetyResult> {
  // Two attempts — most classifier failures are transient (rate limit,
  // cold start, brief upstream blip), which is exactly what stranded
  // Caroline on 9/9.
  let lastErr = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return await callClassifier(opts);
    } catch (e) {
      lastErr = e instanceof Error ? e.message : "unknown";
      if (attempt === 0) await new Promise((r) => setTimeout(r, 400));
    }
  }

  // Degraded mode. Fail by RISK, not blanket-clarify:
  //   • no sensitive signal at all → ALLOW. An outage on our side must
  //     never stop somebody entering "Registered Nurse" or "Logistics".
  //   • sensitive signal present → hold, and say plainly that this is a
  //     temporary system problem rather than implying the user typed
  //     something wrong.
  if (!hasSensitiveSignal(opts.input)) {
    return {
      verdict: "allow",
      reason: `degraded_allow_benign:${lastErr}`,
      layer: "degraded",
    };
  }
  return {
    verdict: "clarify",
    reason: `degraded_hold_sensitive:${lastErr}`,
    layer: "degraded",
    clarifyPrompt:
      "Our safety check is temporarily unavailable, so we've paused this one. Please try again in a moment, or describe the role in a bit more detail.",
  };
}

// ─── Orchestrator ──────────────────────────────────────────────────
export async function screenInput(opts: {
  input: string;
  context?: string[];
  surface: "jobseeker_skill" | "employer_role" | "employer_skill";
  /** Cheap layers only — used on high-frequency paths. */
  skipAI?: boolean;
}): Promise<SafetyResult> {
  const input = (opts.input || "").trim();
  if (!input) return { verdict: "allow", reason: "empty", layer: "fastpath" };

  const hit = fastPathBlock(input);
  if (hit) {
    // A fastpath hit on a phrase carrying protective markers is NOT an
    // auto-block: "Human Trafficking Prevention Specialist" trips
    // /human traffick/ but is legitimate. Send it to the AI, which is
    // told a respectable suffix does not launder an illicit noun. If the
    // AI is unreachable we fall back to the known-legitimate list, and
    // only block if that has no opinion either.
    if (hasProtectiveMarker(input)) {
      if (isKnownLegitimate(input)) {
        return { verdict: "allow", reason: "known_legitimate_over_fastpath", layer: "legitimate" };
      }
      const r = await classifySafetyWithAI({
        input,
        context: opts.context,
        surface: opts.surface,
      });
      if (r.layer === "degraded") {
        // Can't verify a phrase that hit a hard-block pattern — hold it.
        return {
          verdict: "clarify",
          reason: `protective_unverified:${r.reason}`,
          layer: "degraded",
          clarifyPrompt:
            "Our safety check is temporarily unavailable. Please try again in a moment.",
        };
      }
      return { ...r, reason: `protective_candidate→ai:${r.reason}` };
    }
    return { verdict: "block", reason: `fastpath:${hit}`, layer: "fastpath" };
  }

  // Known-legitimate occupations short-circuit BEFORE the AI: cheaper,
  // and immune to classifier outages. Safe because the input must BE the
  // occupation, not merely contain one.
  if (isKnownLegitimate(input)) {
    return { verdict: "allow", reason: "known_legitimate", layer: "legitimate" };
  }

  if (opts.skipAI) return { verdict: "allow", reason: "fastpath_only", layer: "fastpath" };
  return classifySafetyWithAI({
    input,
    context: opts.context,
    surface: opts.surface,
  });
}

/** Neutral end-user copy. Never leaks the reason string. */
export const BLOCK_MESSAGE_JOBSEEKER =
  "This activity isn't supported on PayRanker. Please enter a legitimate occupational skill instead.";
export const BLOCK_MESSAGE_EMPLOYER =
  "This role can't be posted on Skilmatch because it describes an activity we don't support. Please revise the role or required skills.";
