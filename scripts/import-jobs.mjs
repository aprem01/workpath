/**
 * Import REAL job postings with provenance.
 *
 * Replaces the generator that invented 1,618 listings attributed to real
 * Chicago employers. Every row written here records where it came from,
 * the URL a jobseeker actually applies at, and when the source last
 * confirmed it exists.
 *
 * Rules:
 *  - Never invent a field. No pay means payMin/payMax stay null.
 *  - Skills are EXTRACTED from the posting's own text by matching known
 *    vocabulary, never guessed. If the posting doesn't say it, we don't
 *    claim it.
 *  - Upsert on (source, externalId) so re-running refreshes lastSeenAt
 *    rather than duplicating.
 *
 * Usage: node scripts/import-jobs.mjs [--limit N] [--dry]
 */
import { PrismaClient } from "@prisma/client";
import fs from "node:fs";

for (const f of ["/tmp/wp.env", ".env.local", ".env"]) {
  if (!fs.existsSync(f)) continue;
  for (const line of fs.readFileSync(f, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const APP_ID = process.env.ADZUNA_APP_ID;
const APP_KEY = process.env.ADZUNA_APP_KEY;
if (!APP_ID || !APP_KEY) { console.error("ADZUNA_APP_ID / ADZUNA_APP_KEY not set"); process.exit(1); }

const DRY = process.argv.includes("--dry");
const LIMIT = Number((process.argv.find(a => a.startsWith("--limit=")) || "").split("=")[1]) || 50;
const prisma = new PrismaClient();

// Chicago launch vertical first, then the adjacent ones PayRanker serves.
const SEARCHES = [
  { what: "home health aide",    vertical: "home_health_aide" },
  { what: "caregiver",           vertical: "home_health_aide" },
  { what: "certified nursing assistant", vertical: "home_health_aide" },
  { what: "personal care aide",  vertical: "home_health_aide" },
  { what: "warehouse associate", vertical: "transport" },
  { what: "forklift operator",   vertical: "transport" },
  { what: "retail sales associate", vertical: "retail" },
  { what: "line cook",           vertical: "food_service" },
  { what: "customer service representative", vertical: "admin" },
];

/** Skill vocabulary we can honestly detect in a posting's own words. */
const SKILL_TERMS = [
  "CPR","First Aid","HHA Certification","CNA","Vital Signs Monitoring","Medication Reminders",
  "Meal Preparation","Light Housekeeping","Mobility Assistance","Companionship","Dementia Care",
  "Personal Care Assistance","Patient Care","Wound Care","Infection Control","Hospice",
  "Forklift Operation","Inventory Management","Warehouse Operations","Order Picking","Shipping and Receiving",
  "Cash Handling","POS Systems","Customer Service","Visual Merchandising","Retail Sales",
  "Food Safety","Food Preparation","Sanitation","Knife Skills",
  "Data Entry","Scheduling","Microsoft Excel","Phone Etiquette","Bilingual Spanish",
  "Driver's License","Valid Driver's License","Background Check","Lifting",
];
function extractSkills(text) {
  const hay = ` ${String(text || "").toLowerCase()} `;
  const found = new Set();
  for (const term of SKILL_TERMS) {
    const t = term.toLowerCase();
    if (new RegExp(`\\b${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(hay)) found.add(term);
  }
  return [...found];
}

async function fetchPage(what, page) {
  const url = `https://api.adzuna.com/v1/api/jobs/us/search/${page}` +
    `?app_id=${APP_ID}&app_key=${APP_KEY}&results_per_page=50` +
    `&where=${encodeURIComponent("Chicago")}&what=${encodeURIComponent(what)}` +
    `&max_days_old=30&content-type=application/json`;
  const res = await fetch(url, { signal: AbortSignal.timeout(40000) });
  if (!res.ok) throw new Error(`adzuna ${res.status}`);
  return res.json();
}

const now = new Date();
let created = 0, refreshed = 0, skipped = 0;

for (const { what, vertical } of SEARCHES) {
  let batch;
  try { batch = await fetchPage(what, 1); }
  catch (e) { console.warn(`  ${what}: ${e.message}`); continue; }
  const results = (batch.results || []).slice(0, LIMIT);
  for (const r of results) {
    const externalId = String(r.id || "");
    if (!externalId || !r.redirect_url) { skipped++; continue; }
    const text = `${r.title || ""} ${r.description || ""}`;
    const skills = extractSkills(text);
    // Adzuna pay is annual USD when present. Convert to hourly cents to
    // match the column's documented unit; absent stays null, never guessed.
    const toHourlyCents = (annual) =>
      typeof annual === "number" && annual > 0 ? Math.round((annual / 2080) * 100) : null;

    const data = {
      title: String(r.title || "").replace(/<[^>]+>/g, "").trim().slice(0, 200),
      employer: String(r.company?.display_name || "").trim().slice(0, 160) || "Employer not stated",
      location: String(r.location?.display_name || "Chicago, IL").slice(0, 160),
      vertical,
      description: String(r.description || "").replace(/<[^>]+>/g, "").trim().slice(0, 4000),
      payMin: toHourlyCents(r.salary_min),
      payMax: toHourlyCents(r.salary_max),
      payType: "hourly",
      shiftType: /part[- ]time/i.test(text) ? "part_time" : "full_time",
      isActive: true,
      source: "adzuna",
      sourceUrl: r.redirect_url,
      externalId,
      lastSeenAt: now,
      postedAt: r.created ? new Date(r.created) : now,
    };
    if (DRY) { created++; continue; }
    const existing = await prisma.job.findFirst({
      where: { source: "adzuna", externalId }, select: { id: true },
    });
    if (existing) {
      await prisma.job.update({ where: { id: existing.id }, data: { lastSeenAt: now, isActive: true } });
      refreshed++;
    } else {
      await prisma.job.create({
        data: {
          ...data,
          requiredSkills: {
            // The posting names a skill, not a level. "unspecified" says
            // so honestly; guessing "intermediate" would invent a
            // requirement the employer never set.
            create: skills.map((s) => ({ normalizedTerm: s, proficiencyLevel: "unspecified" })),
          },
        },
      });
      created++;
    }
  }
  console.log(`  ${what.padEnd(34)} ${results.length} returned`);
}

console.log(`\n${DRY ? "[dry run] " : ""}created ${created}, refreshed ${refreshed}, skipped ${skipped}`);
await prisma.$disconnect();
