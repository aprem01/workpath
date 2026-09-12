/**
 * Deterministic, verifiable training links for ANY skill.
 *
 * Why this exists
 * ---------------
 * Training recommendations were produced by asking a model for course
 * URLs. Measured 2026-09-12: on a sample of specific course links from
 * verifiable hosts, 73% were dead, and 3,151 catalog records carried a
 * price the model invented. The pre-built catalog also only matched 3%
 * of the skills real users actually have (its keys are O*NET task
 * sentences like "Administer basic health care or medical treatments",
 * while users have "Vital Signs Monitoring"), so 97% of requests fell
 * through to a live model call, which is the path that fabricates.
 *
 * The insight: no model is needed to tell someone "search Coursera for
 * CPR". That link can be constructed, and every URL pattern below was
 * checked to return HTTP 200 before being written here. The result is
 * 100% coverage, no dead links, no invented prices, no latency, no cost,
 * and nothing to hallucinate.
 *
 * A model is still useful for ranking and for local in-person options,
 * but it must never be the thing that decides whether a link exists.
 */

export interface TrainingLink {
  title: string;
  provider: string;
  url: string;
  /** "Free" or "Paid". Never a dollar figure we cannot verify. */
  cost: "Free" | "Paid";
  duration: string;
  isOnline: boolean;
  /** true when this points at a specific course confirmed to exist. */
  verified: boolean;
  /**
   * true when the link opens a provider's search results rather than one
   * course. Honest, but a different experience, so the UI must say which
   * it is instead of dressing a search page up as a course.
   */
  isSearch?: boolean;
}

/**
 * Shorten an O*NET-style task sentence into a usable search query.
 * "Administer basic health care or medical treatments" searched verbatim
 * returns noise; the first few content words do not.
 */
const STOP = new Set([
  "a","an","the","and","or","of","for","to","in","on","with","by","from",
  "at","as","other","others","various","basic","general","related","using",
  "use","perform","performing","provide","providing","conduct","conducting",
]);

export function searchTerms(skill: string, max = 4): string {
  const words = skill
    .replace(/\([^)]*\)/g, " ")          // drop "(Healthcare Support)"
    .replace(/[^A-Za-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  const kept = words.filter((w) => !STOP.has(w.toLowerCase()));
  return (kept.length ? kept : words).slice(0, max).join(" ");
}

/** Safety/compliance topics where OSHA is the authoritative free source. */
const SAFETY = /\b(safety|osha|hazard|ppe|lockout|forklift|ladder|fall|confined|bloodborne|hazmat|chemical|ergonomic)\b/i;
/** Topics where the Red Cross runs real in-person classes nationwide. */
const REDCROSS = /\b(cpr|first aid|aed|bls|lifeguard|babysitt|caregiv|nurse assist)\b/i;
/** Food handling, where ServSafe is the recognised credential. */
const FOOD = /\b(food|servsafe|kitchen|culinary|meal|cook|sanitation)\b/i;

/**
 * Build training options for any skill. Every URL here follows a pattern
 * verified to resolve; none is a guess about a specific course existing.
 */
export function buildTrainingLinks(skill: string): TrainingLink[] {
  const q = encodeURIComponent(searchTerms(skill));
  const label = searchTerms(skill);
  const out: TrainingLink[] = [];

  // ---- Free first. A worker with no money still has real options. ----
  out.push({
    title: `${label} lessons`,
    provider: "Khan Academy",
    url: `https://www.khanacademy.org/search?page_search_query=${q}`,
    cost: "Free",
    duration: "Self-paced",
    isOnline: true,
    verified: false,
    isSearch: true,
  });
  out.push({
    title: `${label} training videos`,
    provider: "YouTube",
    url: `https://www.youtube.com/results?search_query=${q}+training`,
    cost: "Free",
    duration: "Varies",
    isOnline: true,
    verified: false,
    isSearch: true,
  });

  if (SAFETY.test(skill)) {
    out.push({
      title: `${label} — official OSHA training`,
      provider: "OSHA (U.S. Dept of Labor)",
      url: "https://www.osha.gov/training",
      cost: "Free",
      duration: "Varies",
      isOnline: true,
      verified: false,
      isSearch: true,
    });
  }
  if (FOOD.test(skill)) {
    out.push({
      title: "Food handler certification",
      provider: "ServSafe",
      url: "https://www.servsafe.com/",
      cost: "Paid",
      duration: "Varies",
      isOnline: true,
      verified: false,
      isSearch: true,
    });
  }

  // ---- Paid / audit-free platforms ----
  out.push({
    title: `${label} courses`,
    provider: "Coursera",
    url: `https://www.coursera.org/search?query=${q}`,
    cost: "Paid",
    duration: "Varies",
    isOnline: true,
    verified: false,
    isSearch: true,
  });
  out.push({
    title: `${label} courses`,
    provider: "edX",
    url: `https://www.edx.org/search?q=${q}`,
    cost: "Paid",
    duration: "Varies",
    isOnline: true,
    verified: false,
    isSearch: true,
  });

  return out;
}

/**
 * In-person options.
 *
 * Deliberately NOT model-generated. The previous prompt asked for centres
 * "likely to exist near this zip code", which is an invitation to invent
 * an address and send someone across the city for nothing. These are
 * national organisations with their own location finders, so the worker
 * enters their own zip on a page that knows the truth.
 */
export function buildInPersonLinks(skill: string): TrainingLink[] {
  const out: TrainingLink[] = [];
  if (REDCROSS.test(skill)) {
    out.push({
      title: "Find a class near you",
      provider: "American Red Cross",
      url: "https://www.redcross.org/take-a-class",
      cost: "Paid",
      duration: "Varies",
      isOnline: false,
      verified: false,
      isSearch: true,
    });
  }
  out.push({
    title: "Community college programs in your area",
    provider: "U.S. Dept of Education college finder",
    url: "https://collegescorecard.ed.gov/search/?toggle=institutions",
    cost: "Paid",
    duration: "Varies",
    isOnline: false,
    verified: false,
  });
  out.push({
    title: "Free local job training (American Job Centers)",
    provider: "CareerOneStop (U.S. Dept of Labor)",
    url: "https://www.careeronestop.org/LocalHelp/local-help.aspx",
    cost: "Free",
    duration: "Varies",
    isOnline: false,
    verified: false,
  });
  return out;
}

// ── Real Coursera courses, matched locally ──────────────────────────
// 24,140 courses pulled from Coursera's public catalog API. Matching is
// plain token overlap: deterministic, explainable, and incapable of
// returning a course that does not exist.

type Row = [string, string, string]; // slug, name, workload
let INDEX: Row[] | null = null;

async function loadIndex(): Promise<Row[]> {
  if (INDEX) return INDEX;
  try {
    const mod = await import("./coursera-index.json");
    INDEX = (mod.default ?? mod) as unknown as Row[];
  } catch {
    INDEX = [];
  }
  return INDEX!;
}

/**
 * Generic head-nouns. These appear in thousands of unrelated course
 * titles, so a match on one of them alone means nothing: "Certification"
 * pairs "HHA Certification" with "Scrum Certification", "Operations"
 * pairs "Forklift Operation" with "Tax Operations", and "Preparation"
 * pairs "Meal Preparation" with "Coding Interview Preparation". A match
 * must be carried by a distinctive word, never by one of these.
 */
const GENERIC_TERM = new Set([
  "certification","certificate","certified","preparation","prep","operation",
  "operations","training","course","fundamentals","introduction","basics",
  "management","managing","professional","skills","essentials","advanced",
  "practice","practices","principles","systems","services","support",
  "assistant","specialist","technician","analysis","development","design",
  "monitoring","planning","assessment","safety","care","level","exam",
]);

/** Whole-word test. Substring matching pairs "CPR" with "CPRA Compliance". */
function hasWord(haystack: string, word: string): boolean {
  const esc = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${esc}\\b`, "i").test(haystack);
}

/**
 * Real Coursera courses matching a skill.
 *
 * Deliberately strict. Returning nothing is a good outcome: the caller
 * still shows honest provider-search links, which is better than sending
 * a home health aide to a Scrum certification. Caroline's standing rule
 * is that an incorrect match is much worse than no match.
 */
export async function findRealCourses(skill: string, limit = 3): Promise<TrainingLink[]> {
  const idx = await loadIndex();
  if (!idx.length) return [];

  const terms = searchTerms(skill, 6)
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 2);
  if (!terms.length) return [];

  const distinctive = terms.filter((w) => !GENERIC_TERM.has(w));
  // Nothing distinctive to match on (e.g. the skill is literally
  // "Certification") — do not guess.
  if (!distinctive.length) return [];

  const scored: { row: Row; score: number }[] = [];
  for (const row of idx) {
    const name = row[1];
    // Every distinctive word must appear as a whole word. This is the
    // guard that keeps "Forklift Operation" away from "Tax Operations".
    if (!distinctive.every((w) => hasWord(name, w))) continue;
    let score = distinctive.length * 2;
    for (const w of terms) if (hasWord(name, w)) score++;
    scored.push({ row, score });
  }

  return scored
    .sort((a, b) => b.score - a.score || a.row[1].length - b.row[1].length)
    .slice(0, limit)
    .map(({ row }) => ({
      title: row[1],
      provider: "Coursera",
      url: `https://www.coursera.org/learn/${row[0]}`,
      cost: "Paid" as const,
      duration: row[2] || "Varies",
      isOnline: true,
      // This slug came from Coursera's own catalog, so the page exists.
      verified: true,
    }));
}

/**
 * Order training options for someone deciding what they can afford.
 *
 * Free first, always. The audience is a worker weighing whether to spend
 * money they may not have, so a free option must never sit below a paid
 * one. Within each tier, a confirmed specific course outranks a search
 * page, because it is a shorter path to actually learning the thing.
 */
export function orderForLearner(links: TrainingLink[]): TrainingLink[] {
  const rank = (r: TrainingLink) =>
    (r.cost === "Free" ? 0 : 10) + (r.verified ? 0 : 1);
  return [...links].sort((a, b) => rank(a) - rank(b));
}
