/**
 * Generate AI-resistance scores for every skill in lib/taxonomy.ts.
 *
 * Phase 5: PayRanker's brand is "find your future job before AI takes
 * your current one." Today we have an aiResistanceScore field on
 * skills but only ~50 are scored — the other 2,000 default to 50.
 * This script systematically scores every O*NET skill via Claude
 * against a structured rubric.
 *
 * Rubric (0–100):
 *   0–20  EASILY AUTOMATABLE — pattern matching over structured data,
 *         document processing, routine calculation. (Examples: "Data
 *         Entry", "Filing & Records", "Microsoft Excel")
 *   21–40 PARTIALLY AT RISK — judgment over structured info, supervised
 *         decision support. (Examples: "Customer Service", "Scheduling")
 *   41–60 NEUTRAL — mixed automation potential. (Examples: "Project
 *         Coordination", "Quality Control")
 *   61–80 RESISTANT — interpersonal trust, real-time judgment in
 *         unstructured environments. (Examples: "Patient Care",
 *         "Conflict Resolution", "Crew Supervision")
 *   81–100 HIGHLY RESISTANT — physical manipulation, emotional labor,
 *         human-touch services. (Examples: "Bathing & Grooming",
 *         "Dental Hygiene", "Massage Therapy")
 *
 * Run: cd ~/workpath && npx tsx scripts/generate-ai-resistance.ts
 * Cost: ~$2 (Haiku 4.5, ~85 batches of 25 skills)
 * Output: lib/ai-resistance.ts
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as dotenv from "dotenv";
dotenv.config({ path: path.resolve(__dirname, "../.env") });
import Anthropic from "@anthropic-ai/sdk";
import { TAXONOMY } from "../lib/taxonomy";

const OUTPUT = path.resolve(__dirname, "../lib/ai-resistance.ts");
const BATCH_SIZE = 25;
const MODEL = "claude-haiku-4-5-20251001";

const client = new Anthropic();

const PROMPT_PREFIX = `Score each skill 0–100 for resistance to AI automation, using this rubric:

0–20   EASILY AUTOMATABLE — pattern matching over structured data, document
       processing, routine calculation, repetitive scheduling
21–40  PARTIALLY AT RISK — judgment over structured info, supervised
       decision support
41–60  NEUTRAL — mixed automation potential
61–80  RESISTANT — interpersonal trust, real-time judgment in
       unstructured environments, supervisory work
81–100 HIGHLY RESISTANT — physical manipulation, emotional labor,
       human-touch services that require physical presence

EXAMPLES:
- "Data Entry" → 10
- "Microsoft Excel" → 25
- "Customer Service" → 45
- "Conflict Resolution" → 70
- "Bathing & Grooming" → 92
- "Crew Supervision" → 68
- "Massage Therapy" → 88

Return ONLY a JSON object {"skill name": score}. No prose, no markdown.

Skills:
`;

async function runBatch(skills: string[]): Promise<Record<string, number>> {
  const userMsg =
    PROMPT_PREFIX +
    skills.map((s, i) => `${i + 1}. ${s}`).join("\n") +
    "\n\nReturn JSON:";

  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 2048,
    messages: [{ role: "user", content: userMsg }],
  });

  const text = (res.content[0] as { type: string; text: string }).text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/, "")
    .trim();

  try {
    const obj = JSON.parse(text);
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(obj)) {
      const n = typeof v === "number" ? v : parseInt(String(v), 10);
      if (!isNaN(n) && n >= 0 && n <= 100) out[k] = n;
    }
    return out;
  } catch {
    return {};
  }
}

async function main() {
  const allSkills = new Set<string>();
  for (const entry of TAXONOMY) {
    for (const s of entry.skills) allSkills.add(s);
  }
  const skills = Array.from(allSkills).sort();
  console.log(`${skills.length} distinct skills → ~${Math.ceil(skills.length / BATCH_SIZE)} batches`);

  const scores: Record<string, number> = {};
  for (let i = 0; i < skills.length; i += BATCH_SIZE) {
    const batch = skills.slice(i, i + BATCH_SIZE);
    process.stdout.write(`  batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(skills.length / BATCH_SIZE)}…`);
    try {
      const result = await runBatch(batch);
      let added = 0;
      for (const [k, v] of Object.entries(result)) {
        scores[k] = v;
        added++;
      }
      process.stdout.write(` ${added} scored (${Object.keys(scores).length}/${skills.length})\n`);
    } catch (e) {
      process.stdout.write(` failed: ${e instanceof Error ? e.message : "unknown"}\n`);
    }
  }

  console.log(`\nGenerated ${Object.keys(scores).length} AI-resistance scores`);

  // Quartile stats
  const values = Object.values(scores).sort((a, b) => a - b);
  if (values.length > 0) {
    const p25 = values[Math.floor(values.length * 0.25)];
    const p50 = values[Math.floor(values.length * 0.5)];
    const p75 = values[Math.floor(values.length * 0.75)];
    console.log(`  Distribution: p25=${p25}  median=${p50}  p75=${p75}`);
    const aiProofCount = values.filter((v) => v >= 70).length;
    const atRiskCount = values.filter((v) => v <= 30).length;
    console.log(`  AI-proof (≥70): ${aiProofCount}  At-risk (≤30): ${atRiskCount}`);
  }

  const lines: string[] = [];
  lines.push(`/**`);
  lines.push(` * AI-resistance scores per skill — Phase 5.`);
  lines.push(` *`);
  lines.push(` * Generated by scripts/generate-ai-resistance.ts.`);
  lines.push(` * Each skill scored 0-100 against the rubric:`);
  lines.push(` *   0-20  easily automatable  (data entry, document processing)`);
  lines.push(` *   21-40 partially at risk    (supervised decision support)`);
  lines.push(` *   41-60 neutral`);
  lines.push(` *   61-80 resistant            (interpersonal trust, real-time judgment)`);
  lines.push(` *   81-100 highly resistant    (physical, emotional, human-touch)`);
  lines.push(` *`);
  lines.push(` * Used by:`);
  lines.push(` *   - /matches reveal — surfaces "Your top 3 AI-proof skills"`);
  lines.push(` *   - /skills/explore — amber tint at-risk skills, magenta tint resistant`);
  lines.push(` *   - /skills basket — small badge on each pill (≥70 only)`);
  lines.push(` */`);
  lines.push("");
  lines.push(`export const AI_RESISTANCE: Record<string, number> = ${JSON.stringify(scores, null, 2)};`);
  lines.push("");
  lines.push(`/** Returns the AI-resistance score 0-100. Defaults to 50 when unknown. */`);
  lines.push(`export function getAiResistance(skill: string): number {`);
  lines.push(`  return AI_RESISTANCE[skill] ?? 50;`);
  lines.push(`}`);
  lines.push("");
  lines.push(`export function isAiProof(skill: string): boolean {`);
  lines.push(`  return getAiResistance(skill) >= 70;`);
  lines.push(`}`);
  lines.push("");
  lines.push(`export function isAtRisk(skill: string): boolean {`);
  lines.push(`  return getAiResistance(skill) <= 30;`);
  lines.push(`}`);
  lines.push("");

  fs.writeFileSync(OUTPUT, lines.join("\n"));
  console.log(`Wrote ${OUTPUT}`);
}

main().catch((e) => {
  console.error("fatal:", e);
  process.exit(1);
});
