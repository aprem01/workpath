/**
 * Expand the Neo4j HHA taxonomy per Caroline's spec:
 * - More HHA aliases
 * - Near-HHA positions (Companion Care, Hospice Care, Dialysis Tech)
 * - Aliases for those positions
 * - Parent-child + micro skills for each
 *
 * Run: cd /Users/prem/workpath && npx tsx scripts/expand-hha-taxonomy.ts
 */

import neo4j from "neo4j-driver";
import * as dotenv from "dotenv";
dotenv.config();

const driver = neo4j.driver(
  process.env.NEO4J_URI!,
  neo4j.auth.basic(process.env.NEO4J_USERNAME!, process.env.NEO4J_PASSWORD!)
);

async function run() {
  const session = driver.session({ database: process.env.NEO4J_DATABASE });
  console.log("Expanding HHA taxonomy in Neo4j Aura...\n");

  // ─── 1. Add HHA-domain ALIASES ─────────────────────────────────
  console.log("Adding HHA aliases...");
  const hhaAliases: Record<string, string> = {
    // Caregiving aliases
    "caregiving": "Personal Care Assistance",
    "caregiver": "Personal Care Assistance",
    "caring": "Personal Care Assistance",
    "elderly care": "Personal Care Assistance",
    "old people care": "Personal Care Assistance",
    "senior care": "Personal Care Assistance",
    "in-home care": "Personal Care Assistance",
    "home care": "Personal Care Assistance",
    "patient care": "Personal Care Assistance",
    "personal care": "Personal Care Assistance",

    // Companion aliases
    "companion": "Companionship",
    "in-home companionship": "Companionship",
    "companion care": "Companionship",
    "social visiting": "Companionship",
    "friendly visiting": "Companionship",

    // Hospice aliases
    "hospice care": "Hospice Care",
    "end of life care": "Hospice Care",
    "palliative care": "Hospice Care",

    // Dialysis aliases
    "dialysis": "Dialysis Technician",
    "dialysis tech": "Dialysis Technician",
    "dialysis assistant": "Dialysis Technician",

    // Medical assistant aliases
    "medical assistant": "Medical Assistant",
    "med assistant": "Medical Assistant",
    "ma": "Medical Assistant",

    // Retirement home aliases
    "retirement home assistant": "Personal Care Assistance",
    "retiree helper": "Personal Care Assistance",
    "assisted living aide": "Personal Care Assistance",

    // Common care tasks
    "wheelchair": "Mobility Assistance",
    "feeding": "Personal Care Assistance",
    "dressing": "Hygiene Assistance",
    "toileting": "Hygiene Assistance",
    "respite care": "Personal Care Assistance",
  };

  let added = 0;
  for (const [rawTerm, canonicalTerm] of Object.entries(hhaAliases)) {
    try {
      await session.run(
        `MATCH (s:Skill {canonicalTerm: $canonical})
         MERGE (a:Alias {rawTerm: $raw})
         MERGE (a)-[:MAPS_TO]->(s)`,
        { raw: rawTerm, canonical: canonicalTerm }
      );
      added++;
    } catch (e) {
      console.log(`  Skip "${rawTerm}" — ${(e as Error).message.substring(0, 40)}`);
    }
  }
  console.log(`  Added ${added} aliases.\n`);

  // ─── 2. Add NEAR-HHA POSITIONS as canonical skill nodes ────────
  console.log("Adding near-HHA position nodes...");
  const positions = [
    {
      term: "Hospice Care",
      ai: 92,
      vertical: "home_health_aide",
      children: [
        { term: "End-of-Life Comfort Care", ai: 95 },
        { term: "Family Bereavement Support", ai: 92 },
        { term: "Pain Management Awareness", ai: 70 },
      ],
    },
    {
      term: "Dialysis Technician",
      ai: 60,
      vertical: "home_health_aide",
      children: [
        { term: "Dialysis Machine Operation", ai: 55 },
        { term: "Infection Control", ai: 65 },
        { term: "Patient Vital Monitoring", ai: 55 },
      ],
    },
    {
      term: "Medical Assistant",
      ai: 55,
      vertical: "home_health_aide",
      children: [
        { term: "Patient Intake", ai: 50 },
        { term: "Electronic Medical Records", ai: 35 },
        { term: "Phlebotomy Basics", ai: 75 },
      ],
    },
    {
      term: "Pediatric Caregiver",
      ai: 90,
      vertical: "home_health_aide",
      children: [
        { term: "Child Behavior Management", ai: 92 },
        { term: "Pediatric Nutrition", ai: 75 },
        { term: "Child Safety", ai: 85 },
      ],
    },
  ];

  let nodesAdded = 0;
  let edgesAdded = 0;
  for (const pos of positions) {
    try {
      // Create the position node
      await session.run(
        `MERGE (s:Skill {canonicalTerm: $term})
         ON CREATE SET s.layer = 'canonical', s.aiResistance = $ai, s.vertical = $v`,
        { term: pos.term, ai: neo4j.int(pos.ai), v: pos.vertical }
      );
      nodesAdded++;

      // Create child nodes and HAS_CHILD edges
      for (const child of pos.children) {
        await session.run(
          `MERGE (c:Skill {canonicalTerm: $term})
           ON CREATE SET c.layer = 'canonical', c.aiResistance = $ai, c.vertical = $v
           WITH c
           MATCH (p:Skill {canonicalTerm: $parent})
           MERGE (p)-[:HAS_CHILD]->(c)`,
          {
            term: child.term,
            ai: neo4j.int(child.ai),
            v: pos.vertical,
            parent: pos.term,
          }
        );
        nodesAdded++;
        edgesAdded++;
      }
    } catch (e) {
      console.log(`  Skip "${pos.term}" — ${(e as Error).message.substring(0, 40)}`);
    }
  }
  console.log(`  Added ${nodesAdded} nodes, ${edgesAdded} edges.\n`);

  // ─── 3. Cross-position RELATED_TO bridges ───────────────────────
  console.log("Adding cross-position bridges...");
  const bridges: [string, string][] = [
    ["Hospice Care", "Personal Care Assistance"],
    ["Hospice Care", "Companionship"],
    ["Hospice Care", "Dementia Care Awareness"],
    ["Dialysis Technician", "Vital Signs Monitoring"],
    ["Dialysis Technician", "Documentation"],
    ["Medical Assistant", "Vital Signs Monitoring"],
    ["Medical Assistant", "Documentation"],
    ["Pediatric Caregiver", "Personal Care Assistance"],
    ["Pediatric Caregiver", "Companionship"],
  ];

  let bridgesAdded = 0;
  for (const [from, to] of bridges) {
    try {
      await session.run(
        `MATCH (a:Skill {canonicalTerm: $from}), (b:Skill {canonicalTerm: $to})
         MERGE (a)-[:RELATED_TO]->(b)
         MERGE (b)-[:RELATED_TO]->(a)`,
        { from, to }
      );
      bridgesAdded++;
    } catch {}
  }
  console.log(`  Added ${bridgesAdded} bridges.\n`);

  // ─── 4. Final summary ───────────────────────────────────────────
  const summary = await session.run(
    `MATCH (s:Skill) WITH count(s) AS skills
     MATCH (a:Alias) WITH skills, count(a) AS aliases
     MATCH ()-[r:HAS_CHILD]->() WITH skills, aliases, count(r) AS childRels
     MATCH ()-[r:RELATED_TO]->() WITH skills, aliases, childRels, count(r) AS relatedRels
     RETURN skills, aliases, childRels, relatedRels`
  );

  const c = summary.records[0];
  console.log(`═══ Final Graph State ═══`);
  console.log(`  Skill nodes:        ${c.get("skills")}`);
  console.log(`  Aliases:            ${c.get("aliases")}`);
  console.log(`  HAS_CHILD edges:    ${c.get("childRels")}`);
  console.log(`  RELATED_TO edges:   ${c.get("relatedRels")}`);

  await session.close();
  await driver.close();
  console.log("\nExpansion complete.");
}

run().catch((e) => {
  console.error("Failed:", e);
  process.exit(1);
});
