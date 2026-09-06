/**
 * Prohibited-activity screening — shared between PayRanker and Skilmatch.
 *
 * Caroline 9/4 Round 9 requirements:
 *   1. Evaluate meaning + context, not just keywords.
 *   2. Catch euphemisms, misspellings, leetspeak, coded language, and
 *      legitimate-sounding job titles that disguise illicit activity.
 *   3. NEVER block legitimate occupations that contain sensitive words
 *      (Human Trafficking Prevention Specialist, Addiction Counselor,
 *      Narcotics Investigator, Crime Scene Photographer, etc.).
 *   4. Evaluate the CUMULATIVE Skills Basket — ordinary skills must not
 *      "wash out" an illicit one, and an ambiguous term that is fine
 *      alone becomes suspicious when the surrounding basket points at
 *      illicit intent.
 *   5. When ambiguous, ask for clarification rather than assume.
 *
 * Three verdicts:
 *   "block"   — clearly illicit; refuse, generate nothing.
 *   "clarify" — ambiguous in context; ask user what they mean.
 *   "allow"   — legitimate.
 *
 * Layering:
 *   L0 normalizeForMatching  — strips leetspeak / spacing / punctuation.
 *   L1 isProtectiveRole      — allowlist override; ALWAYS "allow".
 *   L2 fastPathBlock         — high-confidence regex on the normalized text.
 *   L3 AI classifier         — Claude sees raw input + basket + returns verdict.
 *
 * Keep L2 narrow. Anything borderline belongs in L3 where the model
 * can see context.
 */

import Anthropic from "@anthropic-ai/sdk";

export type SafetyVerdict = "allow" | "clarify" | "block";

export interface SafetyResult {
  verdict: SafetyVerdict;
  /** Human-readable reason, never surfaced verbatim to end users. */
  reason: string;
  /** Which layer decided: L1 protective, L2 fast-path, L3 ai. */
  layer: "protective" | "fastpath" | "ai" | "error";
  /** For "clarify": a neutral question to show the user. */
  clarifyPrompt?: string;
}

// ─── L0: obfuscation normalizer ────────────────────────────────────
// Maps common leetspeak and spacing tricks back to plain lowercase so
// "p1mp", "p!mp", "p i m p", "p-i-m-p" all collapse to "pimp".
const LEET: Record<string, string> = {
  "0": "o",
  "1": "i",
  "3": "e",
  "4": "a",
  "5": "s",
  "7": "t",
  "@": "a",
  "$": "s",
  "!": "i",
  "|": "l",
};

export function normalizeForMatching(input: string): string {
  let s = input.toLowerCase();
  // Leetspeak substitution
  s = s.replace(/[0134578@$!|]/g, (c) => LEET[c] ?? c);
  // Asterisk / dot / dash / underscore inside words ("dr*g", "s.e.x", "p-i-m-p")
  s = s.replace(/(?<=\w)[*.\-_](?=\w)/g, "");
  // "p i m p" — single letters separated by single spaces. Collapse ONLY
  // when every token is 1 char so we don't glue real words together.
  s = s.replace(/\b(?:\w\s){2,}\w\b/g, (m) => m.replace(/\s/g, ""));
  // Collapse whitespace
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

// ─── L1: protective / legitimate-sensitive role allowlist ──────────
// Roles that legitimately contain sensitive words. Any match here
// short-circuits to "allow" BEFORE the fast-path regex runs, so
// "Human Trafficking Prevention Specialist" never trips the
// /human trafficking/ pattern.
const PROTECTIVE_MARKERS =
  /\b(prevention|prevent|counsel(or|ing)|therap(ist|y)|rehab(ilitation)?|recovery|treatment|educator|education|instructor|teacher|trainer|researcher|research|academic|scholar|professor|investigator|investigation|detective|enforcement|officer|prosecutor|attorney|lawyer|advocate|advocacy|survivor|victim|support\s+specialist|social\s+worker|case\s+manager|outreach|awareness|harm\s+reduction|nurse|pharmacist|pharmacy\s+technician|forensic|crime\s+scene|analyst|compliance|audit(or)?|regulator|inspector|policy)\b/i;

const SENSITIVE_TOPICS =
  /\b(traffick\w*|narcotic\w*|drug\w*|substance\w*|addiction|sex\w*|adult|porn\w*|child\w*|pimp\w*|prostitut\w*|gambl\w*|fraud|launder\w*|weapon\w*|firearm\w*|violence|abuse|exploitation)\b/i;

export function isProtectiveRole(input: string): boolean {
  const n = normalizeForMatching(input);
  return SENSITIVE_TOPICS.test(n) && PROTECTIVE_MARKERS.test(n);
}

// ─── L2: fast-path hard blocks ─────────────────────────────────────
// ONLY high-confidence unambiguous phrases. Runs on the leet-normalized
// string. Anything that could have a legitimate reading goes to L3.
const FASTPATH_BLOCK: RegExp[] = [
  // drug trade
  /\b(drug|narcotics?|cocaine|meth|heroin|fentanyl|opioids?|crack|weed|marijuana)\s+(deal(er|ing)?|traffick(er|ing)?|sell(er|ing)?|distribut(or|ion)|push(er|ing)?|runner|mule)\b/,
  /\b(sell(ing)?|deal(ing)?|push(ing)?|distribut(e|ing))\s+(drugs?|narcotics?|cocaine|meth|heroin|fentanyl|opioids?|crack|pills?)\b/,
  /\bdrug\s+(trafficker|lord|kingpin|cartel)\b/,
  /\b(controlled\s+substance|narcotics?)\s+(distribution|distributor|sales?|dealer)\b/,
  /\b(underground|black[\s-]?market|illegal|illicit|unlicensed|off[\s-]the[\s-]books)\s+(pharmac\w*|pharmaceutical\w*|drug\w*|substance\w*|medication\w*|goods?|courier|logistics)\b/,
  // human / sex trafficking (protective roles already short-circuited)
  /\b(human|sex|child|labor|organ)\s+traffick(er|ing)\b/,
  /\bchild\s+(exploitation|porn\w*|abuse\s+material|sex\w*)\b/,
  /\bcommercial\s+sex(ual)?\s+(work(er)?|recruit\w*|exploitation)\b/,
  // sex work / procurement
  /\bpimp(s|ing|ed)?\b/,
  /\bprostitut(e|es|ion|ing)\b/,
  /\bbrothel\b/,
  /\bescort\s+(service|agency|business|operator)\b/,
  /\bsex\s+work(er)?\b/,
  /\b(whor\w*|hooker\w*|streetwalk\w*)\b/,
  // violence for hire
  /\bhit\s*(man|men|woman|women|person)\b/,
  /\bcontract\s+kill(er|ing)\b/,
  /\bmurder\s+for\s+hire\b/,
  /\bassassin(ate|ation)?\b/,
  // financial crime
  /\bmoney\s+launder(er|ing)\b/,
  /\bracket(eer(ing)?)?\b/,
  /\b(fraud|scam|ponzi|pyramid)\s+scheme\b/,
  /\bmoney\s+mule\b/,
  /\bidentity\s+the(ft|if)\b/,
  /\b(counterfeit|stolen)\s+goods?\s+(seller|dealer|distributor|fence)\b/,
  /\bforge(r|ry)\b/,
  // weapons
  /\billegal\s+(arms?|weapons?|firearms?)\s+(deal\w*|traffick\w*|sales?)\b/,
  /\barms?\s+traffick\w*\b/,
  // gambling
  /\billegal\s+gambling\b/,
  // adult content involving minors or coercion — already caught above
  /\bporn\s+(videographer|photographer|producer|director|actor|actress)\b/,
];

export function fastPathBlock(input: string): string | null {
  const n = normalizeForMatching(input);
  for (const rx of FASTPATH_BLOCK) {
    if (rx.test(n)) return rx.source;
  }
  return null;
}

// ─── L3: AI contextual classifier ─────────────────────────────────
// Sees the raw input + surrounding basket. Returns a verdict + short
// reason + (for clarify) a neutral question.
const client = new Anthropic();

export async function classifySafetyWithAI(opts: {
  input: string;
  /** Other skills / requirements already in the basket / job. */
  context?: string[];
  /** "jobseeker_skill" | "employer_role" | "employer_skill" */
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

Decide whether the platform may facilitate this. Return ONLY valid JSON:
{ "verdict": "allow" | "clarify" | "block", "reason": "<one sentence>", "clarifyPrompt": "<only for clarify — a short neutral question asking the user to describe the legitimate work>" }

RULES

BLOCK when the input clearly describes an illegal activity or illegal
employment, including when disguised:
- Drug dealing / trafficking / distribution of controlled substances
  ("recreational product distributor", "cash-only substances",
  "no-questions-asked delivery", "unlicensed medication supplier").
- Human / sex / child trafficking; procurement of sex work
  ("adult-services manager", "private services to paying clients",
  "recruit young women for an adult business").
- Violence for hire, weapons trafficking, money laundering, fraud
  schemes, counterfeit / stolen goods trade, identity theft.
- Production or distribution of child sexual abuse material.
- Adult pornography production when the context indicates coercion,
  minors, or trafficking. (Legal adult-entertainment business
  management with no such signals → allow.)

ALLOW legitimate occupations even when they contain sensitive words:
- Human Trafficking Prevention Specialist, Addiction Counselor,
  Substance Abuse Counselor, Sexual Health Educator, Sexual Assault
  Counselor, Adult Education Instructor, academic researcher of
  pornography, Forensic / Crime Scene Photographer, Child Protection
  Social Worker, Narcotics Investigator, Drug Rehabilitation
  Counselor, Pharmacist, Pharmacy Technician, Harm Reduction Worker,
  Adult Entertainment Manager (no coercion signals), Companion / Home
  Companion / In-Home Companion (elder-care), Escort (security detail),
  Bartender, Cannabis Dispensary Associate (where legal), Delivery
  Driver, Courier.
Roles whose purpose is to PREVENT, TREAT, INVESTIGATE, PROSECUTE,
EDUCATE ABOUT, or PROTECT FROM an illicit activity are ALWAYS legitimate.

CLARIFY when the input is genuinely ambiguous and the surrounding context
does not resolve it — OR when the input is individually innocuous but the
surrounding basket points toward illicit intent:
- "Discreet Delivery" alone → clarify. With context of
  Logistics + Driving + Cash Handling → clarify (do NOT allow).
- "Adult Client Services" alone → clarify. With Recruitment + Hospitality
  → clarify.
- "Companionship Services", "Private Companionship" → clarify
  (legitimate elder-care reading exists, so do not block outright,
  but do not assume).
- "Independent recreational product distributor" → block (no honest
  reading).
Ordinary skills must NOT wash out a suspicious one: evaluate the basket
as a whole.

Be precise. Do not over-block. A recruiter hiring an "Adult Education
Instructor" or a caregiver listing "Companionship" must not be stopped.`;

  try {
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
        : "clarify"; // uncertain parse → ask, never assume allow
    return {
      verdict,
      reason: parsed.reason || "classifier",
      layer: "ai",
      clarifyPrompt:
        verdict === "clarify"
          ? parsed.clarifyPrompt ||
            `Can you describe the legitimate work you mean by "${opts.input}"?`
          : undefined,
    };
  } catch (e) {
    // Caroline's global rule: an incorrect match is worse than no match.
    // If the classifier is unreachable we CLARIFY rather than allow.
    return {
      verdict: "clarify",
      reason: `classifier_error: ${e instanceof Error ? e.message : "unknown"}`,
      layer: "error",
      clarifyPrompt: `We couldn't verify "${opts.input}" right now. Can you describe the legitimate work you mean?`,
    };
  }
}

// ─── Orchestrator ──────────────────────────────────────────────────
/**
 * Full screen: L1 → L2 → L3.
 * `skipAI` lets high-volume call sites (e.g. every keystroke in the
 * Skilmatch role dropdown) run only the cheap layers; the final commit
 * path should always run with AI.
 */
export async function screenInput(opts: {
  input: string;
  context?: string[];
  surface: "jobseeker_skill" | "employer_role" | "employer_skill";
  skipAI?: boolean;
}): Promise<SafetyResult> {
  const input = (opts.input || "").trim();
  if (!input) return { verdict: "allow", reason: "empty", layer: "fastpath" };

  // L1 — protective / legitimate-sensitive occupations always pass.
  if (isProtectiveRole(input)) {
    return { verdict: "allow", reason: "protective_role", layer: "protective" };
  }
  // L2 — unambiguous hard blocks.
  const hit = fastPathBlock(input);
  if (hit) {
    return { verdict: "block", reason: `fastpath:${hit}`, layer: "fastpath" };
  }
  // L3 — context-aware AI.
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
