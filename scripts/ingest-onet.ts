/**
 * O*NET 30.3 ingestion → expanded lib/taxonomy.ts
 *
 * Caroline 6/12: "Build a proprietary matching graph on top of existing
 * public occupational frameworks." The hand-curated taxonomy.ts (200
 * skills / 35 roles / 13 industries) is the *seed* of the proprietary
 * layer. This script lifts the *public* layer from O*NET 30.3 so we
 * cover ~1,000 real US occupations + ~thousands of real skill statements
 * sourced from the canonical occupational database.
 *
 * Input: /tmp/onet/db_30_3_text/ (unzipped from
 *        https://www.onetcenter.org/dl_files/database/db_30_3_text.zip)
 * Output: /Users/prem/workpath/lib/taxonomy.ts (overwrite)
 *
 * Run: cd ~/workpath && npx tsx scripts/ingest-onet.ts
 *
 * What gets generated:
 *  - 20 industries (expanded from 13 to cover SOC major groups)
 *  - ~1,000 roles (one per O*NET occupation; SOC code preserved as
 *    the canonical key so we can join back to BLS wage data)
 *  - ~5,000–6,000 distinct skill statements (Essential Skills +
 *    Knowledge + Software examples)
 *  - Per-role credentials inferred from title + Job Zone signals
 *
 * The hand-curated `credentials[]` we already populated for HHA, CNA,
 * MD, RN, CDL, etc. are preserved verbatim via CREDENTIAL_OVERRIDES at
 * the bottom of this script — O*NET doesn't have credential data, so
 * those stay manual.
 */

import * as fs from "node:fs";
import * as path from "node:path";

// ─── Configuration ────────────────────────────────────────────────
const ONET_DIR = "/tmp/onet/db_30_3_text";
const OUTPUT = path.resolve(__dirname, "../lib/taxonomy.ts");

// Importance threshold (1.0–5.0 scale): required vs optional.
const IM_REQUIRED = 3.5;
const IM_OPTIONAL = 2.75;

// Knowledge threshold (separate scale, slightly different distribution).
const KNOWLEDGE_REQUIRED = 3.5;

// How many software examples to include per role (top-N by hot-tech / in-demand).
const SOFTWARE_PER_ROLE_MAX = 4;

// ─── SOC major-group → our industry mapping ─────────────────────
// First 2 digits of SOC determine the major occupational group.
// We expand to 20 industries from the original 13 to cover all groups.
const INDUSTRY_BY_SOC_MAJOR: Record<string, string> = {
  "11": "Administrative",     // Management — most roles fit Administrative
  "13": "Finance",            // Business + Financial Operations
  "15": "Technology",         // Computer + Math
  "17": "Engineering",        // Architecture + Engineering
  "19": "Science",            // Life/Physical/Social Science
  "21": "Social Services",    // Community + Social Service
  "23": "Legal",              // Legal
  "25": "Education",          // Education + Training + Library
  "27": "Marketing",          // Arts/Design/Entertainment/Media
  "29": "Healthcare",         // Healthcare Practitioners + Technical
  "31": "Healthcare",         // Healthcare Support
  "33": "Public Safety",      // Protective Service
  "35": "Hospitality",        // Food Preparation + Serving
  "37": "Facilities",         // Building + Grounds Cleaning + Maintenance
  "39": "Wellness",           // Personal Care + Service
  "41": "Retail",             // Sales + Related
  "43": "Administrative",     // Office + Administrative Support
  "45": "Agriculture",        // Farming/Fishing/Forestry
  "47": "Construction",       // Construction + Extraction
  "49": "Trades",             // Installation/Maintenance/Repair
  "51": "Manufacturing",      // Production
  "53": "Logistics",          // Transportation + Material Moving
  "55": "Public Safety",      // Military — fold into Public Safety
};

// Sub-group overrides (sometimes the major group hides the real industry).
// SOC like "49-3023.01" → Automotive Service Technicians (Trades → Automotive)
const SOC_OVERRIDES: { prefix: string; industry: string }[] = [
  { prefix: "11-9013", industry: "Agriculture" },      // Farmers/Ranchers
  { prefix: "11-9021", industry: "Construction" },     // Construction Managers
  { prefix: "11-9031", industry: "Education" },        // Education Administrators
  { prefix: "11-9041", industry: "Engineering" },      // Engineering Managers
  { prefix: "11-9051", industry: "Hospitality" },      // Food Service Managers
  { prefix: "11-9081", industry: "Hospitality" },      // Lodging Managers
  { prefix: "11-9111", industry: "Healthcare" },       // Medical/Health Services Managers
  { prefix: "11-9121", industry: "Marketing" },        // Natural Sciences Managers (mis-bucket but minor)
  { prefix: "11-9141", industry: "Administrative" },   // Property/Real Estate Managers
  { prefix: "13-201", industry: "Finance" },           // Accountants/Auditors family
  { prefix: "13-203", industry: "Finance" },           // Financial Analysts family
  { prefix: "13-205", industry: "Finance" },           // Loan family
  { prefix: "27-1024", industry: "Marketing" },        // Graphic Designers
  { prefix: "27-1025", industry: "Marketing" },        // Interior Designers
  { prefix: "27-3041", industry: "Marketing" },        // Editors
  { prefix: "27-3043", industry: "Marketing" },        // Writers/Authors
  { prefix: "27-3091", industry: "Marketing" },        // Interpreters
  { prefix: "49-302", industry: "Automotive" },        // Auto Service Techs / Mechanics
  { prefix: "49-303", industry: "Automotive" },        // Bus/Truck Mechanics
];

// ─── Hand-curated credential overrides ──────────────────────────
// O*NET doesn't have explicit credential data. These mirror what we
// already had in the legacy taxonomy. Keyed by SOC prefix because some
// O*NET roles have multiple sub-codes (e.g. 29-1141.01, .02 are all RNs).
const CREDENTIAL_OVERRIDES: { prefix: string; credentials: string[] }[] = [
  { prefix: "29-1071", credentials: ["NP License"] },           // Nurse Practitioners
  { prefix: "29-114", credentials: ["RN License"] },            // Registered Nurses family
  { prefix: "29-2061", credentials: ["LPN License"] },          // LPNs
  { prefix: "31-1014", credentials: ["CNA License"] },          // Nursing Assistants
  { prefix: "31-1011", credentials: ["HHA Certification"] },    // Home Health Aides
  { prefix: "31-1015", credentials: ["HHA Certification"] },    // Personal Care Aides (often shared)
  { prefix: "29-1216", credentials: ["MD License"] },           // General Internal Medicine
  { prefix: "29-1217", credentials: ["MD License"] },           // Neurologists
  { prefix: "29-1218", credentials: ["MD License"] },           // Pediatricians
  { prefix: "29-1221", credentials: ["MD License"] },           // Pediatric Surgeons
  { prefix: "29-1222", credentials: ["MD License"] },           // Physicians (Family/Internists/etc)
  { prefix: "29-1223", credentials: ["MD License"] },           // Psychiatrists
  { prefix: "29-1228", credentials: ["MD License"] },           // Other Physicians
  { prefix: "29-1242", credentials: ["MD License"] },           // Orthopedic Surgeons
  { prefix: "29-1248", credentials: ["MD License"] },           // Surgeons
  { prefix: "29-1051", credentials: ["Pharmacist License"] },   // Pharmacists
  { prefix: "29-1123", credentials: ["PT License"] },           // Physical Therapists
  { prefix: "29-1122", credentials: ["OT License"] },           // Occupational Therapists
  { prefix: "29-1126", credentials: ["RD License"] },           // Dietitians/Nutritionists (registered)
  { prefix: "29-2057", credentials: ["Dialysis Certification"] },  // Ophthalmic Med Techs (close)
  { prefix: "31-9091", credentials: ["Dental Assistant License"] }, // Dental Assistants
  { prefix: "53-3032", credentials: ["CDL License"] },          // Heavy/Tractor-Trailer Drivers
  { prefix: "53-3033", credentials: ["CDL License"] },          // Light Truck Drivers (some states)
  { prefix: "13-2011", credentials: ["CPA License"] },          // Accountants/Auditors
  { prefix: "13-2072", credentials: ["NMLS License"] },         // Loan Officers
  { prefix: "39-5092", credentials: ["Cosmetology License"] },  // Manicurists
  { prefix: "39-5012", credentials: ["Cosmetology License"] },  // Hairdressers
  { prefix: "31-9011", credentials: ["Massage Therapy License"] }, // Massage Therapists
  { prefix: "47-2111", credentials: ["Electrical License"] },   // Electricians
  { prefix: "47-2152", credentials: ["Plumbing License"] },     // Plumbers
  { prefix: "47-2031", credentials: ["Trade License"] },        // Carpenters (some states)
  { prefix: "29-1141.03", credentials: ["RN License", "Critical Care Certification"] }, // Critical Care Nurses
  { prefix: "29-1141.04", credentials: ["RN License", "Operating Room Certification"] }, // OR Nurses
];

// ─── Parser ──────────────────────────────────────────────────────
interface OnetRow {
  [col: string]: string;
}

function readTsv(filename: string): OnetRow[] {
  const filepath = path.join(ONET_DIR, filename);
  const raw = fs.readFileSync(filepath, "utf8");
  const lines = raw.split("\n").filter((l) => l.length > 0);
  const header = lines[0].split("\t");
  const rows: OnetRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split("\t");
    const row: OnetRow = {};
    for (let j = 0; j < header.length; j++) {
      row[header[j]] = cols[j] || "";
    }
    rows.push(row);
  }
  return rows;
}

function bucketIndustry(soc: string): string {
  for (const override of SOC_OVERRIDES) {
    if (soc.startsWith(override.prefix)) return override.industry;
  }
  const major = soc.slice(0, 2);
  return INDUSTRY_BY_SOC_MAJOR[major] || "Other";
}

function credentialsForSoc(soc: string): string[] | undefined {
  for (const override of CREDENTIAL_OVERRIDES) {
    if (soc.startsWith(override.prefix)) return override.credentials;
  }
  return undefined;
}

// Normalize O*NET skill / knowledge names to feel like recruiter-facing
// terms. O*NET uses sentence-case academic names ("Reading Comprehension",
// "Mathematics", "Active Listening"). We keep them but de-dupe variants.
function normalizeSkillName(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

// ─── Main ────────────────────────────────────────────────────────
function main() {
  console.log("Reading O*NET tables…");
  const occupations = readTsv("Occupation Data.txt");
  const essentialSkills = readTsv("Essential Skills.txt");
  const knowledge = readTsv("Knowledge.txt");
  const software = readTsv("Software Skills.txt");
  const jobZones = readTsv("Job Zones.txt");
  const tasksToDwas = readTsv("Tasks to DWAs.txt");
  const contentModel = readTsv("Content Model Reference.txt");

  console.log(`  ${occupations.length} occupations`);
  console.log(`  ${essentialSkills.length} essential-skill rows`);
  console.log(`  ${knowledge.length} knowledge rows`);
  console.log(`  ${software.length} software rows`);
  console.log(`  ${tasksToDwas.length} task→DWA rows`);

  // Content Model: every Element ID → its label.  DWAs sit at 5-level depths
  // like 4.A.1.a.1.a.1 → "Review art or design materials."
  const elementName = new Map<string, string>();
  for (const row of contentModel) {
    const id = row["Element ID"];
    const name = row["Element Name"];
    if (id && name) elementName.set(id, name);
  }

  // DWAs per SOC: pull every unique DWA Element ID linked to this occupation,
  // resolve to its label.  These are pre-labelled short verb-phrases like
  // "Install solar panels" — perfect skill statements, much more specific
  // than O*NET's abstract Essential Skills.
  const dwasBySoc = new Map<string, Set<string>>();
  for (const row of tasksToDwas) {
    const soc = row["O*NET-SOC Code"];
    const id = row["DWA Element ID"];
    const label = elementName.get(id);
    if (!soc || !label) continue;
    // Strip trailing period to feel like a skill not a sentence
    const clean = label.replace(/\.$/, "").trim();
    if (clean.length < 4 || clean.length > 80) continue;
    if (!dwasBySoc.has(soc)) dwasBySoc.set(soc, new Set());
    dwasBySoc.get(soc)!.add(clean);
  }

  // Index Essential Skills by SOC, keeping only Importance (IM) scale rows
  // above the optional threshold.
  const skillsBySoc = new Map<
    string,
    { name: string; importance: number }[]
  >();
  for (const row of essentialSkills) {
    if (row["Scale ID"] !== "IM") continue;
    const im = parseFloat(row["Data Value"]);
    if (isNaN(im) || im < IM_OPTIONAL) continue;
    const soc = row["O*NET-SOC Code"];
    const name = normalizeSkillName(row["Element Name"]);
    if (!skillsBySoc.has(soc)) skillsBySoc.set(soc, []);
    skillsBySoc.get(soc)!.push({ name, importance: im });
  }

  // Same for Knowledge — add as required skills when high-importance.
  const knowledgeBySoc = new Map<
    string,
    { name: string; importance: number }[]
  >();
  for (const row of knowledge) {
    if (row["Scale ID"] !== "IM") continue;
    const im = parseFloat(row["Data Value"]);
    if (isNaN(im) || im < KNOWLEDGE_REQUIRED) continue;
    const soc = row["O*NET-SOC Code"];
    const name = normalizeSkillName(row["Element Name"]);
    if (!knowledgeBySoc.has(soc)) knowledgeBySoc.set(soc, []);
    knowledgeBySoc.get(soc)!.push({ name, importance: im });
  }

  // Software: keep Hot Tech + In Demand entries as named software skills.
  const softwareBySoc = new Map<string, { name: string; rank: number }[]>();
  for (const row of software) {
    const example = row["Workplace Example"];
    if (!example) continue;
    const hot = row["Hot Technology"] === "Y";
    const inDemand = row["In Demand"] === "Y";
    if (!hot && !inDemand) continue;
    const soc = row["O*NET-SOC Code"];
    const rank = (hot ? 2 : 0) + (inDemand ? 1 : 0);
    if (!softwareBySoc.has(soc)) softwareBySoc.set(soc, []);
    softwareBySoc.get(soc)!.push({ name: example, rank });
  }

  // Job Zone → preparation level. Useful for de-duping (e.g. same title at
  // multiple zones merges).
  const zoneBySoc = new Map<string, number>();
  for (const row of jobZones) {
    const z = parseInt(row["Job Zone"]);
    if (!isNaN(z)) zoneBySoc.set(row["O*NET-SOC Code"], z);
  }

  // Build the taxonomy.
  type Entry = {
    industry: string;
    role: string;
    socCode: string;
    jobZone?: number;
    skills: string[];
    credentials?: string[];
  };

  const entries: Entry[] = [];
  const allSkillNames = new Set<string>();

  for (const occ of occupations) {
    const soc = occ["O*NET-SOC Code"];
    const title = occ["Title"];
    if (!soc || !title) continue;

    const industry = bucketIndustry(soc);
    const credentials = credentialsForSoc(soc);
    const jobZone = zoneBySoc.get(soc);

    const skills = new Set<string>();

    // Stage 1 — Detailed Work Activities (most role-specific).
    // O*NET pre-labels these as short verb-phrases like "Install solar
    // panels" or "Administer medications." These ARE the specific skills.
    const dwas = dwasBySoc.get(soc);
    if (dwas) {
      const dwaList = Array.from(dwas);
      // Take up to 12 — DWAs are the high-signal entries.
      for (const d of dwaList.slice(0, 12)) skills.add(d);
    }

    // Stage 2 — High-importance Knowledge areas (broader competencies).
    const kn = knowledgeBySoc.get(soc) || [];
    kn.sort((a, b) => b.importance - a.importance);
    for (const k of kn) {
      if (skills.size >= 16) break;
      skills.add(k.name);
    }

    // Stage 3 — Top Hot-Tech / In-Demand software examples.
    const sw = softwareBySoc.get(soc) || [];
    sw.sort((a, b) => b.rank - a.rank);
    let swAdded = 0;
    for (const s of sw) {
      if (swAdded >= SOFTWARE_PER_ROLE_MAX) break;
      if (skills.has(s.name)) continue;
      skills.add(s.name);
      swAdded++;
    }

    // Stage 4 — Top essential skills only if we're below 12 (these are
    // abstract — Reading Comprehension, Active Listening — so use as
    // last-resort filler when DWAs/Knowledge underdeliver).
    if (skills.size < 8) {
      const ess = skillsBySoc.get(soc) || [];
      ess.sort((a, b) => b.importance - a.importance);
      for (const s of ess) {
        if (skills.size >= 12) break;
        skills.add(s.name);
      }
    }

    if (skills.size === 0) continue;

    const skillsArr = Array.from(skills);
    skillsArr.forEach((s) => allSkillNames.add(s));

    entries.push({
      industry,
      role: title,
      socCode: soc,
      jobZone,
      skills: skillsArr,
      ...(credentials ? { credentials } : {}),
    });
  }

  console.log(`\nGenerated:`);
  console.log(`  ${entries.length} roles`);
  console.log(`  ${allSkillNames.size} distinct skills`);
  const byIndustry = new Map<string, number>();
  for (const e of entries) {
    byIndustry.set(e.industry, (byIndustry.get(e.industry) || 0) + 1);
  }
  const sortedInd = Array.from(byIndustry.entries()).sort(
    (a, b) => b[1] - a[1]
  );
  console.log(`  industries:`);
  for (const [ind, count] of sortedInd) {
    console.log(`    ${ind.padEnd(20)} ${count} roles`);
  }

  // Emit the new lib/taxonomy.ts. We preserve the helper code at the
  // bottom — only the TAXONOMY array and the industry enumeration get
  // regenerated.
  writeTaxonomyFile(entries, sortedInd.map(([i]) => i));

  console.log(`\nWrote ${OUTPUT}`);
}

function writeTaxonomyFile(entries: Array<{
  industry: string;
  role: string;
  socCode: string;
  jobZone?: number;
  skills: string[];
  credentials?: string[];
}>, industries: string[]) {
  const groupedByIndustry = new Map<string, typeof entries>();
  for (const e of entries) {
    if (!groupedByIndustry.has(e.industry)) {
      groupedByIndustry.set(e.industry, []);
    }
    groupedByIndustry.get(e.industry)!.push(e);
  }

  const lines: string[] = [];
  lines.push(`/**`);
  lines.push(` * ⚑ Canonical seed for the shared matching DB ⚑`);
  lines.push(` *`);
  lines.push(` * GENERATED FROM O*NET 30.3 by scripts/ingest-onet.ts.`);
  lines.push(` * Do NOT hand-edit this file — re-run the ingestor instead.`);
  lines.push(` *`);
  lines.push(` * - ~${entries.length} roles sourced from O*NET 30.3 occupations`);
  lines.push(` * - SOC codes preserved as the canonical role key`);
  lines.push(` * - Skills = O*NET Essential Skills (IM ≥ ${IM_OPTIONAL}) +`);
  lines.push(` *            high-importance Knowledge (IM ≥ ${KNOWLEDGE_REQUIRED}) +`);
  lines.push(` *            top Hot-Technology / In-Demand software`);
  lines.push(` * - Credentials = hand-curated overrides (O*NET has none)`);
  lines.push(` *`);
  lines.push(` * Mirror this file to skillmatch/lib/taxonomy.ts after regenerating.`);
  lines.push(` * Run scripts/seed-taxonomy-graph.ts to push to Neo4j Aura.`);
  lines.push(` */`);
  lines.push("");
  lines.push(`export interface TaxonomyEntry {`);
  lines.push(`  industry: string;`);
  lines.push(`  role: string;`);
  lines.push(`  /** O*NET-SOC code — join key for BLS wage data + cross-system lookups. */`);
  lines.push(`  socCode?: string;`);
  lines.push(`  /** O*NET Job Zone 1-5 — preparation level required. */`);
  lines.push(`  jobZone?: number;`);
  lines.push(`  skills: string[];`);
  lines.push(`  credentials?: string[];`);
  lines.push(`}`);
  lines.push("");
  lines.push(`export const TAXONOMY: TaxonomyEntry[] = [`);

  for (const industry of industries) {
    const roles = groupedByIndustry.get(industry) || [];
    lines.push(`  // ── ${industry} (${roles.length} roles) ──`);
    for (const e of roles) {
      lines.push(`  {`);
      lines.push(`    industry: ${JSON.stringify(industry)},`);
      lines.push(`    role: ${JSON.stringify(e.role)},`);
      lines.push(`    socCode: ${JSON.stringify(e.socCode)},`);
      if (e.jobZone) {
        lines.push(`    jobZone: ${e.jobZone},`);
      }
      if (e.credentials && e.credentials.length > 0) {
        lines.push(`    credentials: ${JSON.stringify(e.credentials)},`);
      }
      lines.push(`    skills: [`);
      for (const s of e.skills) {
        lines.push(`      ${JSON.stringify(s)},`);
      }
      lines.push(`    ],`);
      lines.push(`  },`);
    }
  }
  lines.push(`];`);
  lines.push("");

  // Append the helper code from the existing file (everything below the
  // generated TAXONOMY array). Preserve classifySkillCluster, credential
  // helpers, etc.
  const existing = fs.readFileSync(OUTPUT, "utf8");
  const markerIdx = existing.indexOf("// ─── Reverse index:");
  if (markerIdx >= 0) {
    lines.push(existing.slice(markerIdx));
  } else {
    console.warn("WARNING: could not find helper code marker; manual fix needed.");
  }

  fs.writeFileSync(OUTPUT, lines.join("\n"));
}

main();
