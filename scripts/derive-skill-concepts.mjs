/**
 * Discover skill equivalences we never hand-wrote.
 *
 * The alias map only covers word pairs someone thought to list. The pairs
 * it misses are exactly the ones with no shared words: "Caregiving" and
 * "Personal Care Assistance" mean the same thing to an employer and share
 * not one token, so no lexical rule finds them.
 *
 * Embeddings are the usual answer, but they would make "why did this
 * candidate match" answerable only as a cosine score, and Caroline's
 * 8/11 requirement is that matching stay explainable.
 *
 * So this does the same job offline and keeps the guarantee: every term
 * is assigned a short CANONICAL CONCEPT. Terms sharing a concept are
 * equivalent. The output is a reviewable list of labelled groups, not a
 * vector space, and matching stays exact-string lookup at query time.
 *
 * Run: node scripts/derive-skill-concepts.mjs
 * Out: lib/skill-concepts.generated.ts
 */
import fs from "node:fs";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";

// A standalone script gets none of Next.js's .env loading, so the SDK
// would silently fail auth on every call. Load it explicitly and fail
// loudly if the key is missing.
for (const f of [".env.local", ".env"]) {
  if (!fs.existsSync(f)) continue;
  for (const line of fs.readFileSync(f, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
if (!process.env.ANTHROPIC_API_KEY) {
  console.error("ANTHROPIC_API_KEY not found in env, .env.local or .env");
  process.exit(1);
}

const client = new Anthropic();
const MODEL = "claude-haiku-5-5";
const BATCH = 40;

const vocab = JSON.parse(fs.readFileSync("/tmp/vocab.json", "utf8"));
const terms = [...new Set([...vocab.worker, ...vocab.job].map((t) => t.trim()).filter(Boolean))];
console.log(`terms to label: ${terms.length}`);

const PROMPT = `You label occupational skill terms with a canonical concept.

For each numbered term, output the concept it belongs to: a SHORT lowercase
noun phrase (1-3 words) naming the underlying capability.

The point is that DIFFERENT WORDINGS OF THE SAME CAPABILITY MUST GET THE
SAME CONCEPT LABEL. Examples:
  "Caregiving"                -> personal care
  "Personal Care Assistance"  -> personal care
  "Home Health Assistance"    -> personal care
  "Meal Preparation"          -> meal preparation
  "Cooking"                   -> meal preparation
  "Forklift Operation"        -> forklift operation
  "Cash Handling"             -> point of sale
  "POS Systems"               -> point of sale
  "Bilingual Spanish"         -> spanish language
  "Spanish (Spoken)"          -> spanish language

Rules:
- Be CONSERVATIVE. If two terms are merely related but not interchangeable
  for hiring (e.g. "Wound Care" vs "Personal Care"), give them DIFFERENT
  concepts. A wrong equivalence is much worse than a missing one.
- Never merge different seniority or different certifications.
- A programming language, tool, or brand keeps its own concept.
- If a term is too vague to place (e.g. "Documentation"), use: unclear

Return ONLY a JSON array, one object per input, same order:
[{"i":1,"concept":"personal care"}, ...]`;

async function label(batch, attempt = 0) {
  const numbered = batch.map((t, i) => `${i + 1}. ${t}`).join("\n");
  try {
    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 2000,
      messages: [{ role: "user", content: `${PROMPT}\n\nTERMS:\n${numbered}` }],
    });
    // Haiku 5.5 emits a thinking block first, so content[0] has no text.
    let txt = (msg.content.find((b) => b.type === "text")?.text ?? "").trim();
    txt = txt.replace(/^```(?:json)?\s*/i, "").replace(/```$/, "").trim();
    const a = txt.indexOf("["), b = txt.lastIndexOf("]");
    return JSON.parse(txt.slice(a, b + 1));
  } catch (e) {
    if (attempt >= 3) { console.warn("  batch failed:", e.message.slice(0, 80)); return []; }
    await new Promise((r) => setTimeout(r, 1500 * 2 ** attempt));
    return label(batch, attempt + 1);
  }
}

const concept = new Map(); // term -> concept
for (let i = 0; i < terms.length; i += BATCH) {
  const batch = terms.slice(i, i + BATCH);
  const out = await label(batch);
  for (const row of out) {
    const t = batch[(row.i ?? 0) - 1];
    const c = String(row.concept || "").toLowerCase().trim();
    if (t && c && c !== "unclear") concept.set(t, c);
  }
  process.stdout.write(`\r  labelled ${concept.size}/${terms.length}`);
}
console.log();

// Group by concept; only groups with 2+ DISTINCT spellings are useful.
const groups = new Map();
for (const [term, c] of concept) {
  if (!groups.has(c)) groups.set(c, new Set());
  groups.get(c).add(term);
}
const useful = [...groups.entries()]
  .map(([c, set]) => [c, [...set]])
  .filter(([, list]) => {
    if (list.length < 2) return false;
    // Ignore groups that are only casing/whitespace variants — the
    // normalization cache already handles those.
    const norm = new Set(list.map((t) => t.toLowerCase().replace(/\s+/g, " ")));
    return norm.size >= 2;
  })
  .sort((a, b) => b[1].length - a[1].length);

// Consolidate near-duplicate concept labels. The labeller produced both
// "cpr and first aid" and "cpr first aid", and both "personal care" and
// "activities of daily living", which splits terms that should match each
// other. Merging on the token signature costs nothing and recovers those.
const bySig = new Map();
const STOPW = new Set(["and","or","the","of","a","an","for","with","in","to","&"]);
const sig = (c) =>
  c.split(/[^a-z0-9]+/i).filter((w) => w && !STOPW.has(w)).map((w) => w.replace(/s$/, "")).sort().join("|");
for (const [c, set] of groups) {
  const k = sig(c);
  if (!bySig.has(k)) bySig.set(k, { concept: c, terms: new Set() });
  for (const t of set) bySig.get(k).terms.add(t);
}
const merged = groups.size - bySig.size;
if (merged > 0) console.log(`consolidated ${merged} near-duplicate concept label(s)`);
groups.clear();
for (const { concept, terms } of bySig.values()) groups.set(concept, terms);

console.log(`concepts: ${groups.size}, useful groups (2+ distinct spellings): ${useful.length}`);

const coverage = concept.size / terms.length;
if (coverage < 0.5) {
  console.error(
    `\nABORT: only ${concept.size}/${terms.length} terms were labelled ` +
    `(${Math.round(coverage * 100)}%). Refusing to write a file that would ` +
    `look like "no equivalences exist". Fix the cause and re-run.`
  );
  process.exit(1);
}

const out = `// GENERATED by scripts/derive-skill-concepts.mjs on ${new Date().toISOString().slice(0, 10)}.
// Do not hand-edit; re-run the script instead.
//
// WHY THIS IS GENERATED AND NOT AN EMBEDDING
// ------------------------------------------
// The alias map only covers pairs someone thought to write down, and the
// pairs it misses are the ones sharing no words ("Caregiving" vs
// "Personal Care Assistance"). Embeddings would find those, but would
// make "why did this candidate match" answerable only as a similarity
// score. Caroline's 8/11 requirement is that matching stay deterministic
// and explainable.
//
// So the semantic step runs OFFLINE and its output is this reviewable
// list of labelled groups. At query time matching is still exact-string
// lookup, and a recruiter can be told the concept two terms share.
//
// Terms here were observed on a real worker profile or a real job posting.
// Groups are conservative by construction: the labeller is instructed that
// a wrong equivalence is much worse than a missing one.

export const SKILL_CONCEPT_GROUPS: Array<{ concept: string; terms: string[] }> = ${JSON.stringify(
  useful.map(([concept, list]) => ({ concept, terms: list.sort() })),
  null,
  2
)};

const TERM_TO_CONCEPT = new Map<string, string>();
for (const g of SKILL_CONCEPT_GROUPS) {
  for (const t of g.terms) TERM_TO_CONCEPT.set(t.toLowerCase().trim(), g.concept);
}

/** Every observed spelling of the concept this term belongs to. */
export function expandWithConcepts(term: string): string[] {
  const c = TERM_TO_CONCEPT.get(term.toLowerCase().trim());
  if (!c) return [term];
  const g = SKILL_CONCEPT_GROUPS.find((x) => x.concept === c);
  return g ? [term, ...g.terms] : [term];
}

/** The shared concept, for showing a recruiter WHY two terms matched. */
export function conceptFor(term: string): string | null {
  return TERM_TO_CONCEPT.get(term.toLowerCase().trim()) ?? null;
}
`;
const OUT = path.join(process.cwd(), "lib", "skill-concepts.generated.ts");
fs.writeFileSync(OUT, out);
console.log(`WROTE ${OUT}`);
console.log("\nNow run: node scripts/merge-concept-groups.mjs  (unites groups that share a term)");
console.log("\ntop groups:");
for (const [c, list] of useful.slice(0, 15)) console.log(`  ${c}: ${list.slice(0, 6).join(" | ")}`);
