/**
 * Merge concept groups that share a term.
 *
 * The labeller gives equivalent groups different names: "Personal Care
 * Assistance" landed in [personal care] while "ADL Assistance" landed in
 * [activities of daily living], so a worker who wrote one could not reach
 * a job asking the other — the exact failure this whole effort exists to
 * fix. Both groups contained the same normalized term ("adl assistance"),
 * which is the signal that they are one concept.
 *
 * Union-find over groups, joining any two that share a normalized term.
 * Deterministic and reversible; run it on the generated file.
 */
import fs from "node:fs";

const FILE = "lib/skill-concepts.generated.ts";
const src = fs.readFileSync(FILE, "utf8");
const m = src.match(/(SKILL_CONCEPT_GROUPS[^=]*=\s*)(\[[\s\S]*?\])(;\n)/);
const groups = JSON.parse(m[2]);

const norm = (t) =>
  t.toLowerCase().replace(/\([^)]*\)/g, " ").replace(/[^a-z0-9]+/g, " ").trim();

const parent = groups.map((_, i) => i);
const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
const union = (a, b) => { const ra = find(a), rb = find(b); if (ra !== rb) parent[rb] = ra; };

const owner = new Map(); // normalized term -> group index
groups.forEach((g, i) => {
  for (const t of g.terms) {
    const k = norm(t);
    if (!k) continue;
    if (owner.has(k)) union(owner.get(k), i);
    else owner.set(k, i);
  }
});

const merged = new Map();
groups.forEach((g, i) => {
  const r = find(i);
  if (!merged.has(r)) merged.set(r, { concept: groups[r].concept, terms: new Set() });
  for (const t of g.terms) merged.get(r).terms.add(t);
});

const out = [...merged.values()]
  .map((g) => ({ concept: g.concept, terms: [...g.terms].sort() }))
  .filter((g) => new Set(g.terms.map(norm)).size >= 2)
  .sort((a, b) => b.terms.length - a.terms.length);

// A runaway chain merge would silently destroy precision, so refuse it.
const biggest = out[0];
if (biggest && biggest.terms.length > 40) {
  console.error(`ABORT: [${biggest.concept}] ballooned to ${biggest.terms.length} terms — chain merge suspected.`);
  process.exit(1);
}

fs.writeFileSync(FILE, src.slice(0, m.index) + m[1] + JSON.stringify(out, null, 2) + m[3] + src.slice(m.index + m[0].length));
console.log(`groups ${groups.length} -> ${out.length}`);
console.log(`largest group: [${biggest.concept}] ${biggest.terms.length} terms`);
