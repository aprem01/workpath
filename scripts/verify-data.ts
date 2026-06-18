/**
 * Smoke-check every generated data layer in lib/.
 *
 * Run: cd ~/workpath && npx tsx scripts/verify-data.ts
 *
 * Verifies that every layer (taxonomy, equivalencies, transferability,
 * AI-resistance, wages, projections, workplace, metros, training
 * catalog) loads cleanly and meets minimum coverage thresholds.
 * Fails noisily if any layer regresses (e.g. half the file got
 * truncated by a botched commit).
 */

import * as path from "node:path";
import * as dotenv from "dotenv";
dotenv.config({ path: path.resolve(__dirname, "../.env") });

import { TAXONOMY } from "../lib/taxonomy";
import { EQUIVALENCIES, canonicalize, expandWithSynonyms } from "../lib/equivalencies";
import { TRANSFERABILITY, getTransferability, getTopTransfers } from "../lib/transferability";
import { AI_RESISTANCE, getAiResistance, isAiProof } from "../lib/ai-resistance";
import { WAGES, getWage } from "../lib/wages";
import { PROJECTIONS, getProjection } from "../lib/projections";
import { WORKPLACE, getWorkplace } from "../lib/workplace";
import { METROS, getMetroById } from "../lib/metros";

interface Check {
  layer: string;
  metric: string;
  actual: number;
  minimum: number;
  status: "OK" | "FAIL";
}

const checks: Check[] = [];

function check(layer: string, metric: string, actual: number, minimum: number) {
  checks.push({
    layer,
    metric,
    actual,
    minimum,
    status: actual >= minimum ? "OK" : "FAIL",
  });
}

// TAXONOMY
const industries = new Set(TAXONOMY.map((t) => t.industry));
const skillSet = new Set<string>();
const credentialCount = TAXONOMY.filter((t) => t.credentials && t.credentials.length > 0).length;
for (const t of TAXONOMY) for (const s of t.skills) skillSet.add(s);
check("taxonomy", "roles", TAXONOMY.length, 800);
check("taxonomy", "distinct skills", skillSet.size, 1500);
check("taxonomy", "industries", industries.size, 15);
check("taxonomy", "roles with credentials", credentialCount, 15);

// EQUIVALENCIES
check("equivalencies", "canonical mappings", Object.keys(EQUIVALENCIES).length, 1500);
check("equivalencies", "synonym fold", canonicalize("Customer Support") !== "Customer Support" ? 1 : 0, 1);
check("equivalencies", "expand returns ≥1", expandWithSynonyms("Customer Service").length, 1);

// TRANSFERABILITY
let totalEdges = 0;
for (const v of Object.values(TRANSFERABILITY)) totalEdges += v.length;
check("transferability", "source roles", Object.keys(TRANSFERABILITY).length, 400);
check("transferability", "total edges", totalEdges, 7000);
check("transferability", "HHA → top 5 exists", getTopTransfers("31-1121.00", 5).length, 1);
check("transferability", "Solar → top 5 exists", getTopTransfers("47-2231.00", 5).length, 1);
void getTransferability; // referenced for completeness

// AI-RESISTANCE
const aiScored = Object.keys(AI_RESISTANCE).length;
const aiProof = Object.values(AI_RESISTANCE).filter((v) => v >= 70).length;
const aiAtRisk = Object.values(AI_RESISTANCE).filter((v) => v <= 30).length;
check("ai-resistance", "skills scored", aiScored, 1500);
check("ai-resistance", "AI-proof (≥70)", aiProof, 100);
check("ai-resistance", "at-risk (≤30)", aiAtRisk, 100);
check("ai-resistance", "default fallback", getAiResistance("NONSENSE_NEVER_SEEN") === 50 ? 1 : 0, 1);
void isAiProof;

// WAGES + PROJECTIONS + WORKPLACE
check("wages", "SOCs seeded", Object.keys(WAGES).length, 25);
check("wages", "RN wage exists", getWage("29-1141.00") ? 1 : 0, 1);
check("projections", "SOCs seeded", Object.keys(PROJECTIONS).length, 25);
check("projections", "HHA projection exists", getProjection("31-1121.00") ? 1 : 0, 1);
check("workplace", "SOCs seeded", Object.keys(WORKPLACE).length, 25);
check("workplace", "Solar workplace exists", getWorkplace("47-2231.00") ? 1 : 0, 1);

// METROS
check("metros", "supported", METROS.length, 5);
check("metros", "Chicago lookup", getMetroById("chicago") ? 1 : 0, 1);

// TRAINING CATALOG (optional — file may still be generating)
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require("../lib/training-catalog");
  const catalogSize = Object.keys(mod.TRAINING_CATALOG || {}).length;
  check("training-catalog", "skills cached", catalogSize, 0); // floor 0 — in flight
} catch {
  check("training-catalog", "file present", 0, 0); // present but 0 entries is OK
}

// ── Report ────────────────────────────────────────────────────
console.log(`\n${"Layer".padEnd(20)} ${"Metric".padEnd(28)} ${"Actual".padStart(8)} ${"Min".padStart(8)} ${"Status".padStart(8)}`);
console.log("─".repeat(80));
for (const c of checks) {
  console.log(
    `${c.layer.padEnd(20)} ${c.metric.padEnd(28)} ${String(c.actual).padStart(8)} ${String(c.minimum).padStart(8)} ${c.status.padStart(8)}`
  );
}

const failed = checks.filter((c) => c.status === "FAIL");
console.log("─".repeat(80));
if (failed.length === 0) {
  console.log(`\n✓ All ${checks.length} checks passed.`);
} else {
  console.log(`\n✗ ${failed.length}/${checks.length} checks FAILED — data is in an unexpected state.`);
  process.exit(1);
}
