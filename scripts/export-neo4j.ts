/**
 * Export the entire Neo4j graph to a flat Cypher script.
 *
 * Use case: full disaster-recovery snapshot of the matching graph.
 * Re-importable into any Neo4j instance via `cypher-shell < dump.cypher`
 * or via APOC.cypher.runFile.
 *
 * Output: ~/Documents/payranker-docs/backups/neo4j-YYYYMMDDTHHMMSSZ.cypher
 *
 * Run: cd ~/workpath && npx tsx scripts/export-neo4j.ts
 *
 * Note: lib/taxonomy.ts + scripts/seed-taxonomy-graph.ts are an
 * equally-valid restore path (just re-run the seed). This export
 * also captures any user-added Skill / Alias nodes the normalize
 * route has accreted over time.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import * as dotenv from "dotenv";
dotenv.config({ path: path.resolve(__dirname, "../.env") });
import neo4j from "neo4j-driver";

const BACKUP_DIR = path.join(
  os.homedir(),
  "Documents/payranker-docs/backups"
);

function tsStamp() {
  const d = new Date();
  return (
    d.getUTCFullYear() +
    String(d.getUTCMonth() + 1).padStart(2, "0") +
    String(d.getUTCDate()).padStart(2, "0") +
    "T" +
    String(d.getUTCHours()).padStart(2, "0") +
    String(d.getUTCMinutes()).padStart(2, "0") +
    String(d.getUTCSeconds()).padStart(2, "0") +
    "Z"
  );
}

function escVal(v: unknown): string {
  if (v === null || v === undefined) return "null";
  if (typeof v === "number") return String(v);
  if (typeof v === "boolean") return String(v);
  if (Array.isArray(v)) return "[" + v.map(escVal).join(", ") + "]";
  // Neo4j Integer wrapper
  if (typeof v === "object" && v !== null && "low" in (v as object)) {
    const obj = v as { low: number; high: number; toNumber?: () => number };
    return obj.toNumber ? String(obj.toNumber()) : String(obj.low);
  }
  // Strings: escape backticks + quotes
  const s = String(v).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
  return `'${s}'`;
}

function escMap(props: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(props)) {
    if (v === undefined) continue;
    parts.push(`${k}: ${escVal(v)}`);
  }
  return `{${parts.join(", ")}}`;
}

async function main() {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const out = path.join(BACKUP_DIR, `neo4j-${tsStamp()}.cypher`);
  const stream = fs.createWriteStream(out);

  const driver = neo4j.driver(
    process.env.NEO4J_URI!,
    neo4j.auth.basic(process.env.NEO4J_USERNAME!, process.env.NEO4J_PASSWORD!)
  );
  const session = driver.session({ database: process.env.NEO4J_DATABASE });

  stream.write("// Neo4j graph export — restore with: cypher-shell < this-file.cypher\n");
  stream.write(`// Generated ${new Date().toISOString()}\n\n`);
  stream.write("MATCH (n) DETACH DELETE n;\n\n");

  // Export every node by label.
  const labelsRes = await session.run("CALL db.labels()");
  const labels = labelsRes.records.map((r) => r.get("label") as string);
  let totalNodes = 0;
  for (const label of labels) {
    const nodesRes = await session.run(`MATCH (n:${label}) RETURN n`);
    for (const rec of nodesRes.records) {
      const node = rec.get("n");
      stream.write(`CREATE (:${label} ${escMap(node.properties)});\n`);
      totalNodes++;
    }
  }
  stream.write("\n");
  console.log(`  ${totalNodes} nodes exported across ${labels.length} labels`);

  // Export every relationship. For each rel type, match endpoints by
  // their canonical key (canonicalTerm for Skill, rawTerm for Alias,
  // etc.) — assumes our schema's uniqueness constraints hold.
  const relsRes = await session.run("CALL db.relationshipTypes()");
  const types = relsRes.records.map((r) => r.get("relationshipType") as string);
  let totalRels = 0;
  for (const type of types) {
    const r = await session.run(
      `MATCH (a)-[r:${type}]->(b) RETURN labels(a)[0] AS la, properties(a) AS pa, properties(r) AS pr, labels(b)[0] AS lb, properties(b) AS pb`
    );
    for (const rec of r.records) {
      const la = rec.get("la");
      const pa = rec.get("pa");
      const lb = rec.get("lb");
      const pb = rec.get("pb");
      const pr = rec.get("pr") || {};
      // Pick a canonical match key per label so MATCH lines stay short.
      const matchKey = (label: string, props: Record<string, unknown>) => {
        if (label === "Skill") return { canonicalTerm: props.canonicalTerm };
        if (label === "Alias") return { rawTerm: props.rawTerm };
        if (label === "Industry") return { name: props.name };
        if (label === "Role") return { industry: props.industry, name: props.name };
        return props;
      };
      stream.write(
        `MATCH (a:${la} ${escMap(matchKey(la, pa))}), (b:${lb} ${escMap(matchKey(lb, pb))}) CREATE (a)-[:${type} ${escMap(pr)}]->(b);\n`
      );
      totalRels++;
    }
  }
  console.log(`  ${totalRels} relationships exported across ${types.length} types`);

  stream.end();
  await session.close();
  await driver.close();

  // Wait for stream flush
  await new Promise<void>((r) => stream.on("close", () => r()));

  const stat = fs.statSync(out);
  console.log(`\nWrote ${out} (${stat.size.toLocaleString()} bytes)`);
}

main().catch((e) => {
  console.error("export failed:", e);
  process.exit(1);
});
