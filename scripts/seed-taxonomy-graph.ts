/**
 * Lift lib/taxonomy.ts into Neo4j Aura as the shared matching DB.
 *
 * Caroline 5/22 sketch: PayRanker and Skilmatch both feed a single
 * industry-bucketed "matching database". This seed creates the
 * Industry > Role > Skill hierarchy in the graph so it can be queried
 * by either app's runtime (with the TS taxonomy as a synchronous
 * fallback for React-side checks).
 *
 * Run:    npx tsx scripts/seed-taxonomy-graph.ts
 *
 * Idempotent: uses MERGE so re-running won't duplicate nodes. Does NOT
 * delete the existing skill graph created by scripts/seed-neo4j.ts —
 * the two seeds layer on top of each other.
 *
 * After this runs, the graph has:
 *   (:Industry {name})
 *     -[:HAS_ROLE]->
 *   (:Role {name, industry})
 *     -[:USES_SKILL]->
 *   (:Skill {canonicalTerm})
 *
 * Skill nodes are upserted with an `industries` array property so a
 * cheap single-node lookup can answer "which industries does this
 * skill belong to" without a graph traversal.
 */

import neo4j from "neo4j-driver";
import * as dotenv from "dotenv";
import { TAXONOMY } from "../lib/taxonomy";

dotenv.config();

const driver = neo4j.driver(
  process.env.NEO4J_URI!,
  neo4j.auth.basic(process.env.NEO4J_USERNAME!, process.env.NEO4J_PASSWORD!)
);

async function seed() {
  const session = driver.session({ database: process.env.NEO4J_DATABASE });

  try {
    console.log("Connecting to Neo4j Aura...");

    // ── Constraints (idempotent) ──────────────────────────────────────
    try {
      await session.run(
        "CREATE CONSTRAINT industry_name IF NOT EXISTS FOR (i:Industry) REQUIRE i.name IS UNIQUE"
      );
      await session.run(
        "CREATE CONSTRAINT role_id IF NOT EXISTS FOR (r:Role) REQUIRE (r.industry, r.name) IS UNIQUE"
      );
      await session.run(
        "CREATE CONSTRAINT skill_term IF NOT EXISTS FOR (s:Skill) REQUIRE s.canonicalTerm IS UNIQUE"
      );
    } catch {
      console.log("  Constraints may already exist, continuing...");
    }

    // ── Build per-skill industry sets so we can write the array property ──
    const skillIndustries = new Map<string, Set<string>>();
    for (const entry of TAXONOMY) {
      for (const skill of entry.skills) {
        if (!skillIndustries.has(skill)) skillIndustries.set(skill, new Set());
        skillIndustries.get(skill)!.add(entry.industry);
      }
    }

    // ── Industry + Role + Skill ──────────────────────────────────────
    let industryCount = 0;
    let roleCount = 0;
    let skillCount = 0;
    let edgeCount = 0;

    const seenIndustries = new Set<string>();

    for (const entry of TAXONOMY) {
      if (!seenIndustries.has(entry.industry)) {
        await session.run(
          "MERGE (i:Industry {name: $name}) ON CREATE SET i.createdAt = datetime()",
          { name: entry.industry }
        );
        seenIndustries.add(entry.industry);
        industryCount++;
      }

      await session.run(
        `MERGE (r:Role {industry: $industry, name: $role})
         ON CREATE SET r.createdAt = datetime()
         WITH r
         MATCH (i:Industry {name: $industry})
         MERGE (i)-[:HAS_ROLE]->(r)`,
        { industry: entry.industry, role: entry.role }
      );
      roleCount++;

      for (const skill of entry.skills) {
        const industries = Array.from(skillIndustries.get(skill) || []);
        await session.run(
          `MERGE (s:Skill {canonicalTerm: $term})
           ON CREATE SET s.layer = 'canonical', s.aiResistance = 50, s.createdAt = datetime()
           SET s.industries = $industries
           WITH s
           MATCH (r:Role {industry: $industry, name: $role})
           MERGE (r)-[:USES_SKILL]->(s)`,
          {
            term: skill,
            industries,
            industry: entry.industry,
            role: entry.role,
          }
        );
        skillCount++;
        edgeCount++;
      }
    }

    console.log(
      `\nDone.\n  Industries: ${industryCount}\n  Roles: ${roleCount}\n  Skill-role edges: ${edgeCount}\n  Unique skills touched: ${skillIndustries.size}`
    );
  } finally {
    await session.close();
    await driver.close();
  }
}

seed().catch((e) => {
  console.error("Seed failed:", e);
  process.exit(1);
});
