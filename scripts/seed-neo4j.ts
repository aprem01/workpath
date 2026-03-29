import neo4j from "neo4j-driver";
import * as dotenv from "dotenv";
dotenv.config();

const driver = neo4j.driver(
  process.env.NEO4J_URI!,
  neo4j.auth.basic(process.env.NEO4J_USERNAME!, process.env.NEO4J_PASSWORD!)
);

async function seed() {
  const session = driver.session({ database: process.env.NEO4J_DATABASE });

  console.log("Connecting to Neo4j Aura...");

  // Clear existing data
  console.log("Clearing existing graph...");
  await session.run("MATCH (n) DETACH DELETE n");

  // Create constraints
  console.log("Creating constraints...");
  try {
    await session.run(
      "CREATE CONSTRAINT skill_term IF NOT EXISTS FOR (s:Skill) REQUIRE s.canonicalTerm IS UNIQUE"
    );
    await session.run(
      "CREATE CONSTRAINT alias_term IF NOT EXISTS FOR (a:Alias) REQUIRE a.rawTerm IS UNIQUE"
    );
  } catch (e) {
    console.log("  Constraints may already exist, continuing...");
  }

  // ═══════════════════════════════════════════════════════════════════
  // PARENT SKILL NODES
  // ═══════════════════════════════════════════════════════════════════
  console.log("\nCreating parent skill nodes...");

  const parents = [
    { term: "Caregiving", aiResistance: 90, vertical: "home_health_aide" },
    { term: "Elderly Care", aiResistance: 88, vertical: "home_health_aide" },
    { term: "Home Management", aiResistance: 70, vertical: "home_health_aide" },
    { term: "Health Monitoring", aiResistance: 55, vertical: "home_health_aide" },
    { term: "Transport", aiResistance: 75, vertical: "home_health_aide" },
  ];

  for (const p of parents) {
    await session.run(
      `CREATE (s:Skill {canonicalTerm: $term, layer: 'parent', aiResistance: $ai, vertical: $v})`,
      { term: p.term, ai: neo4j.int(p.aiResistance), v: p.vertical }
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  // CANONICAL SKILL NODES (children of parents)
  // ═══════════════════════════════════════════════════════════════════
  console.log("Creating canonical skill nodes...");

  const parentChildren: Record<string, { term: string; ai: number }[]> = {
    Caregiving: [
      { term: "Hygiene Assistance", ai: 92 },
      { term: "Mobility Assistance", ai: 90 },
      { term: "Medication Reminders", ai: 55 },
      { term: "Companionship", ai: 95 },
      { term: "Personal Care Assistance", ai: 88 },
    ],
    "Elderly Care": [
      { term: "Fall Prevention", ai: 85 },
      { term: "Dementia Care Awareness", ai: 90 },
      { term: "Transfer Assistance", ai: 88 },
      { term: "Vital Signs Monitoring", ai: 55 },
      { term: "Incontinence Care", ai: 87 },
    ],
    "Home Management": [
      { term: "Light Housekeeping", ai: 60 },
      { term: "Meal Preparation", ai: 65 },
      { term: "Grocery Shopping", ai: 55 },
      { term: "Laundry", ai: 50 },
      { term: "Errands", ai: 60 },
    ],
    "Health Monitoring": [
      { term: "Blood Pressure Monitoring", ai: 50 },
      { term: "Blood Glucose Monitoring", ai: 50 },
      { term: "Medication Administration", ai: 60 },
      { term: "Wound Care Basics", ai: 58 },
    ],
    Transport: [
      { term: "Non-Emergency Medical Transport", ai: 75 },
      { term: "Wheelchair Van Operation", ai: 78 },
      { term: "Appointment Accompaniment", ai: 80 },
    ],
  };

  for (const [parentTerm, children] of Object.entries(parentChildren)) {
    for (const child of children) {
      await session.run(
        `MATCH (p:Skill {canonicalTerm: $parent})
         CREATE (c:Skill {canonicalTerm: $term, layer: 'canonical', aiResistance: $ai, vertical: 'home_health_aide'})
         CREATE (p)-[:HAS_CHILD]->(c)`,
        { parent: parentTerm, term: child.term, ai: neo4j.int(child.ai) }
      );
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // MICRO-SKILL NODES
  // ═══════════════════════════════════════════════════════════════════
  console.log("Creating micro-skill nodes...");

  // First create the canonical roots for micro-skills
  const microRoots = [
    { term: "CPR", ai: 90 },
    { term: "Driving", ai: 75 },
    { term: "Documentation", ai: 40 },
    { term: "First Aid", ai: 88 },
  ];

  for (const r of microRoots) {
    await session.run(
      `CREATE (s:Skill {canonicalTerm: $term, layer: 'canonical', aiResistance: $ai, vertical: 'home_health_aide'})`,
      { term: r.term, ai: neo4j.int(r.ai) }
    );
  }

  const microChildren: Record<string, { term: string; ai: number }[]> = {
    CPR: [
      { term: "CPR: Adult", ai: 90 },
      { term: "CPR: Pediatric", ai: 90 },
      { term: "CPR/AED Certified", ai: 90 },
    ],
    Driving: [
      { term: "Driving: Personal Vehicle", ai: 75 },
      { term: "Driving: Wheelchair Van", ai: 78 },
      { term: "Driving: CDL Class B", ai: 80 },
    ],
    Documentation: [
      { term: "Care Plan Documentation", ai: 40 },
      { term: "HIPAA-Compliant Record Keeping", ai: 45 },
      { term: "Incident Reporting", ai: 42 },
      { term: "Shift Handoff Notes", ai: 38 },
    ],
  };

  for (const [parentTerm, children] of Object.entries(microChildren)) {
    for (const child of children) {
      await session.run(
        `MATCH (p:Skill {canonicalTerm: $parent})
         CREATE (c:Skill {canonicalTerm: $term, layer: 'micro', aiResistance: $ai, vertical: 'home_health_aide'})
         CREATE (p)-[:HAS_CHILD]->(c)`,
        { parent: parentTerm, term: child.term, ai: neo4j.int(child.ai) }
      );
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // CROSS-SKILL RELATIONSHIPS (RELATED_TO)
  // This is the graph magic — skills that bridge across categories
  // ═══════════════════════════════════════════════════════════════════
  console.log("Creating cross-skill relationships...");

  const related: [string, string][] = [
    // Caregiving ↔ Elderly Care bridges
    ["Personal Care Assistance", "Transfer Assistance"],
    ["Companionship", "Dementia Care Awareness"],
    ["Mobility Assistance", "Fall Prevention"],
    ["Hygiene Assistance", "Incontinence Care"],
    // Health ↔ Caregiving bridges
    ["Medication Reminders", "Medication Administration"],
    ["Vital Signs Monitoring", "Blood Pressure Monitoring"],
    ["Personal Care Assistance", "Wound Care Basics"],
    // Transport ↔ Caregiving bridges
    ["Appointment Accompaniment", "Companionship"],
    ["Non-Emergency Medical Transport", "Mobility Assistance"],
    // Safety bridges
    ["CPR", "First Aid"],
    ["Fall Prevention", "Transfer Assistance"],
    // Documentation bridges
    ["Documentation", "Medication Administration"],
  ];

  for (const [from, to] of related) {
    await session.run(
      `MATCH (a:Skill {canonicalTerm: $from}), (b:Skill {canonicalTerm: $to})
       CREATE (a)-[:RELATED_TO]->(b)
       CREATE (b)-[:RELATED_TO]->(a)`,
      { from, to }
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  // ALIASES
  // ═══════════════════════════════════════════════════════════════════
  console.log("Creating aliases...");

  const aliases: Record<string, string> = {
    cooking: "Meal Preparation",
    "making food": "Meal Preparation",
    "helping old people": "Personal Care Assistance",
    "taking care of people": "Personal Care Assistance",
    cleaning: "Light Housekeeping",
    housework: "Light Housekeeping",
    bathing: "Hygiene Assistance",
    "helping someone walk": "Mobility Assistance",
    "giving medicine": "Medication Reminders",
    "keeping company": "Companionship",
    "checking blood pressure": "Blood Pressure Monitoring",
    "driving patients": "Non-Emergency Medical Transport",
    "preventing falls": "Fall Prevention",
    "memory care": "Dementia Care Awareness",
    "lifting patients": "Transfer Assistance",
    "first aid": "First Aid",
    cpr: "CPR",
  };

  for (const [rawTerm, canonical] of Object.entries(aliases)) {
    await session.run(
      `MATCH (s:Skill {canonicalTerm: $canonical})
       CREATE (a:Alias {rawTerm: $raw})
       CREATE (a)-[:MAPS_TO]->(s)`,
      { raw: rawTerm, canonical }
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  // VERIFY
  // ═══════════════════════════════════════════════════════════════════
  const counts = await session.run(
    `MATCH (s:Skill) WITH count(s) AS skills
     MATCH (a:Alias) WITH skills, count(a) AS aliases
     MATCH ()-[r:HAS_CHILD]->() WITH skills, aliases, count(r) AS childRels
     MATCH ()-[r:RELATED_TO]->() WITH skills, aliases, childRels, count(r) AS relatedRels
     RETURN skills, aliases, childRels, relatedRels`
  );

  const c = counts.records[0];
  console.log(`\n═══ Neo4j Graph Seeded ═══`);
  console.log(`  Skill nodes:        ${c.get("skills")}`);
  console.log(`  Aliases:            ${c.get("aliases")}`);
  console.log(`  HAS_CHILD edges:    ${c.get("childRels")}`);
  console.log(`  RELATED_TO edges:   ${c.get("relatedRels")}`);

  // Test a traversal
  console.log("\n═══ Test: 2-hop traversal from 'Meal Preparation' ═══");
  const test = await session.run(
    `MATCH (start:Skill {canonicalTerm: 'Meal Preparation'})
     MATCH path = (start)-[:HAS_CHILD|RELATED_TO*1..2]-(related:Skill)
     RETURN DISTINCT related.canonicalTerm AS skill, length(path) AS hops
     ORDER BY hops ASC`
  );
  for (const r of test.records) {
    console.log(`  ${r.get("hops")} hop(s): ${r.get("skill")}`);
  }

  await session.close();
  await driver.close();
  console.log("\nDone.");
}

seed().catch((e) => {
  console.error("Seed failed:", e);
  process.exit(1);
});
