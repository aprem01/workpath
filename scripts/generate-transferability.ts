/**
 * Transferability scores — Phase 2 of Caroline's taxonomy ladder.
 *
 * For every pair of roles within an industry, compute a Jaccard
 * similarity over their required skill sets. This lets the match API
 * answer Caroline's exact question:
 *
 *   "You're 80% of the way from Warehouse Manager → Distribution
 *    Coordinator. Adding 2 skills would get you the rest of the way."
 *
 * Replaces the binary "qualifies / doesn't qualify" cutoff with a
 * continuous warmth score on Tab B (gap jobs).
 *
 * Run: cd ~/workpath && npx tsx scripts/generate-transferability.ts
 *
 * Output: lib/transferability.ts exporting:
 *   - TRANSFERABILITY: Record<fromSoc, [{ toSoc, score, sharedSkillCount }]>
 *   - getTransferability(fromSoc, toSoc): number
 *
 * No API calls — pure set arithmetic over our ~923 roles. Should run
 * in well under a minute.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as dotenv from "dotenv";
dotenv.config({ path: path.resolve(__dirname, "../.env") });
import { TAXONOMY } from "../lib/taxonomy";

const OUTPUT = path.resolve(__dirname, "../lib/transferability.ts");
const MIN_SCORE = 0.15;            // O*NET DWAs are very specific so Jaccard
                                    // is low even between adjacent roles. 0.15
                                    // captures real transfers like HHA → CNA.
const MAX_TRANSFERS_PER_ROLE = 15; // cap so the file doesn't blow up
const INCLUDE_CROSS_INDUSTRY = true; // Caroline: skills transfer across industries
const CROSS_INDUSTRY_MIN_SCORE = 0.3; // higher bar for cross-industry pairs

function jaccard(a: Set<string>, b: Set<string>): { score: number; sharedCount: number } {
  const aLower = new Set(Array.from(a).map((s) => s.toLowerCase()));
  const bLower = new Set(Array.from(b).map((s) => s.toLowerCase()));
  let shared = 0;
  aLower.forEach((s) => {
    if (bLower.has(s)) shared++;
  });
  const union = aLower.size + bLower.size - shared;
  if (union === 0) return { score: 0, sharedCount: 0 };
  return { score: shared / union, sharedCount: shared };
}

function main() {
  console.log(`Computing transferability over ${TAXONOMY.length} roles…`);

  // Index roles by SOC code (the canonical join key).
  const bySoc = new Map<string, (typeof TAXONOMY)[number]>();
  for (const entry of TAXONOMY) {
    if (entry.socCode) bySoc.set(entry.socCode, entry);
  }

  // Group by industry — within-industry pairs get a lower bar than
  // cross-industry pairs.
  const byIndustry = new Map<string, string[]>();
  for (const entry of TAXONOMY) {
    if (!entry.socCode) continue;
    if (!byIndustry.has(entry.industry)) byIndustry.set(entry.industry, []);
    byIndustry.get(entry.industry)!.push(entry.socCode);
  }

  // pairs computed counter for status reporting
  let pairsComputed = 0;
  const transferability = new Map<
    string,
    { toSoc: string; score: number; sharedSkillCount: number }[]
  >();

  function record(fromSoc: string, toSoc: string, score: number, shared: number) {
    if (!transferability.has(fromSoc)) transferability.set(fromSoc, []);
    transferability.get(fromSoc)!.push({ toSoc, score, sharedSkillCount: shared });
  }

  // Within-industry pairs (cheaper, higher recall).
  for (const [industry, socs] of Array.from(byIndustry.entries())) {
    for (let i = 0; i < socs.length; i++) {
      for (let j = 0; j < socs.length; j++) {
        if (i === j) continue;
        const a = bySoc.get(socs[i])!;
        const b = bySoc.get(socs[j])!;
        const { score, sharedCount } = jaccard(new Set(a.skills), new Set(b.skills));
        pairsComputed++;
        if (score < MIN_SCORE) continue;
        record(socs[i], socs[j], score, sharedCount);
      }
    }
    console.log(`  ${industry.padEnd(20)} ${socs.length} roles → ${socs.length * (socs.length - 1)} candidate pairs`);
  }

  // Cross-industry pairs (higher bar). Caroline's example: customer
  // service + scheduling can transfer Retail → Administrative even if
  // the worker never worked in admin before.
  if (INCLUDE_CROSS_INDUSTRY) {
    console.log("\nComputing cross-industry pairs…");
    const allSocs = Array.from(bySoc.keys());
    for (let i = 0; i < allSocs.length; i++) {
      for (let j = 0; j < allSocs.length; j++) {
        if (i === j) continue;
        const a = bySoc.get(allSocs[i])!;
        const b = bySoc.get(allSocs[j])!;
        if (a.industry === b.industry) continue; // already done above
        const { score, sharedCount } = jaccard(new Set(a.skills), new Set(b.skills));
        pairsComputed++;
        if (score < CROSS_INDUSTRY_MIN_SCORE) continue;
        record(allSocs[i], allSocs[j], score, sharedCount);
      }
    }
  }

  // Cap each role's transfer list to the top N by score.
  let totalEdges = 0;
  transferability.forEach((list) => {
    list.sort((a, b) => b.score - a.score);
    list.splice(MAX_TRANSFERS_PER_ROLE);
    totalEdges += list.length;
  });

  console.log(`\n${pairsComputed.toLocaleString()} pairs computed`);
  console.log(`${transferability.size} roles have at least one transfer`);
  console.log(`${totalEdges.toLocaleString()} transfer edges kept (capped at ${MAX_TRANSFERS_PER_ROLE} per role)`);

  // Spot check
  const sample = ["31-1121.00", "29-1141.00", "47-2231.00", "53-3032.00", "13-2011.00"];
  console.log(`\nSample transfers:`);
  for (const soc of sample) {
    const e = bySoc.get(soc);
    if (!e) continue;
    console.log(`  ${e.role} (${soc}) → top 5:`);
    const top = (transferability.get(soc) || []).slice(0, 5);
    for (const t of top) {
      const target = bySoc.get(t.toSoc);
      if (!target) continue;
      console.log(
        `    ${target.role} (${target.industry})  score=${t.score.toFixed(2)} shared=${t.sharedSkillCount}`
      );
    }
  }

  // Emit
  const lines: string[] = [];
  lines.push(`/**`);
  lines.push(` * Role-to-role transferability scores — Phase 2 of the matching graph.`);
  lines.push(` *`);
  lines.push(` * Generated by scripts/generate-transferability.ts via Jaccard similarity`);
  lines.push(` * over the O*NET-derived skill sets in lib/taxonomy.ts. Within-industry`);
  lines.push(` * pairs use MIN_SCORE=${MIN_SCORE}; cross-industry uses ${CROSS_INDUSTRY_MIN_SCORE}.`);
  lines.push(` *`);
  lines.push(` * Used by /api/jobs/match: when a job's required skills aren't a perfect`);
  lines.push(` * match, surface the transferability score from the user's nearest`);
  lines.push(` * matched role so we can show "75% of the way there" instead of hiding`);
  lines.push(` * the job entirely.`);
  lines.push(` */`);
  lines.push("");
  lines.push(`export interface TransferEdge {`);
  lines.push(`  toSoc: string;`);
  lines.push(`  score: number;          // 0..1 Jaccard over skill sets`);
  lines.push(`  sharedSkillCount: number;`);
  lines.push(`}`);
  lines.push("");
  // Use a plain object (faster JSON lookup, smaller bundle).
  const obj: Record<string, { toSoc: string; score: number; sharedSkillCount: number }[]> = {};
  transferability.forEach((v, k) => {
    obj[k] = v.map((e) => ({
      toSoc: e.toSoc,
      score: Math.round(e.score * 100) / 100, // 2 decimals — keeps file small
      sharedSkillCount: e.sharedSkillCount,
    }));
  });
  lines.push(`export const TRANSFERABILITY: Record<string, TransferEdge[]> = ${JSON.stringify(obj, null, 2)};`);
  lines.push("");
  lines.push(`/**`);
  lines.push(` * Get the transferability score from one role to another.`);
  lines.push(` * Returns 0 if no edge exists (score too low or pair never computed).`);
  lines.push(` */`);
  lines.push(`export function getTransferability(fromSoc: string, toSoc: string): number {`);
  lines.push(`  const edges = TRANSFERABILITY[fromSoc];`);
  lines.push(`  if (!edges) return 0;`);
  lines.push(`  const edge = edges.find((e) => e.toSoc === toSoc);`);
  lines.push(`  return edge?.score ?? 0;`);
  lines.push(`}`);
  lines.push("");
  lines.push(`/**`);
  lines.push(` * Top-N roles a worker in fromSoc can transfer to, sorted by score.`);
  lines.push(` */`);
  lines.push(`export function getTopTransfers(fromSoc: string, n: number = 10): TransferEdge[] {`);
  lines.push(`  return (TRANSFERABILITY[fromSoc] || []).slice(0, n);`);
  lines.push(`}`);
  lines.push("");

  fs.writeFileSync(OUTPUT, lines.join("\n"));
  console.log(`\nWrote ${OUTPUT}`);
}

main();
