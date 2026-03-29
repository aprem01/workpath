import neo4j, { Driver } from "neo4j-driver";

const globalForNeo4j = globalThis as unknown as {
  neo4jDriver: Driver | undefined;
};

const driver =
  globalForNeo4j.neo4jDriver ??
  neo4j.driver(
    process.env.NEO4J_URI!,
    neo4j.auth.basic(process.env.NEO4J_USERNAME!, process.env.NEO4J_PASSWORD!)
  );

if (process.env.NODE_ENV !== "production") globalForNeo4j.neo4jDriver = driver;

export default driver;

// ─── Graph Query Helpers ────────────────────────────────────────────

export interface GraphSkill {
  term: string;
  layer: string;
  aiResistance: number;
  vertical: string | null;
}

/**
 * Find a skill node by alias or canonical term
 */
export async function findSkillNode(rawTerm: string): Promise<GraphSkill | null> {
  const session = driver.session({ database: process.env.NEO4J_DATABASE });
  try {
    const result = await session.run(
      `OPTIONAL MATCH (a:Alias {rawTerm: $term})-[:MAPS_TO]->(s:Skill)
       WITH s
       WHERE s IS NOT NULL
       RETURN s.canonicalTerm AS term, s.layer AS layer, s.aiResistance AS aiResistance, s.vertical AS vertical
       UNION
       MATCH (s:Skill) WHERE toLower(s.canonicalTerm) = $term
       RETURN s.canonicalTerm AS term, s.layer AS layer, s.aiResistance AS aiResistance, s.vertical AS vertical
       LIMIT 1`,
      { term: rawTerm.toLowerCase().trim() }
    );
    if (result.records.length === 0) return null;
    const r = result.records[0];
    return {
      term: r.get("term"),
      layer: r.get("layer"),
      aiResistance: r.get("aiResistance")?.toNumber?.() ?? r.get("aiResistance") ?? 50,
      vertical: r.get("vertical"),
    };
  } finally {
    await session.close();
  }
}

/**
 * Get children of a skill (parent → canonical, canonical → micro)
 */
export async function getChildren(canonicalTerm: string): Promise<GraphSkill[]> {
  const session = driver.session({ database: process.env.NEO4J_DATABASE });
  try {
    const result = await session.run(
      `MATCH (p:Skill {canonicalTerm: $term})-[:HAS_CHILD]->(c:Skill)
       RETURN c.canonicalTerm AS term, c.layer AS layer, c.aiResistance AS aiResistance, c.vertical AS vertical`,
      { term: canonicalTerm }
    );
    return result.records.map((r) => ({
      term: r.get("term"),
      layer: r.get("layer"),
      aiResistance: r.get("aiResistance")?.toNumber?.() ?? r.get("aiResistance") ?? 50,
      vertical: r.get("vertical"),
    }));
  } finally {
    await session.close();
  }
}

/**
 * Get siblings (other children of the same parent)
 */
export async function getSiblings(canonicalTerm: string): Promise<GraphSkill[]> {
  const session = driver.session({ database: process.env.NEO4J_DATABASE });
  try {
    const result = await session.run(
      `MATCH (s:Skill {canonicalTerm: $term})<-[:HAS_CHILD]-(parent)-[:HAS_CHILD]->(sibling:Skill)
       WHERE sibling.canonicalTerm <> $term
       RETURN sibling.canonicalTerm AS term, sibling.layer AS layer, sibling.aiResistance AS aiResistance, sibling.vertical AS vertical`,
      { term: canonicalTerm }
    );
    return result.records.map((r) => ({
      term: r.get("term"),
      layer: r.get("layer"),
      aiResistance: r.get("aiResistance")?.toNumber?.() ?? r.get("aiResistance") ?? 50,
      vertical: r.get("vertical"),
    }));
  } finally {
    await session.close();
  }
}

/**
 * POWER QUERY: Find all related skills within N hops
 * This is why we use a graph DB — Postgres can't do this efficiently
 */
export async function getRelatedWithinHops(
  canonicalTerm: string,
  maxHops: number = 2,
  limit: number = 20
): Promise<GraphSkill[]> {
  const session = driver.session({ database: process.env.NEO4J_DATABASE });
  try {
    const result = await session.run(
      `MATCH (start:Skill {canonicalTerm: $term})
       MATCH path = (start)-[:HAS_CHILD|MAPS_TO|RELATED_TO*1..${maxHops}]-(related:Skill)
       WHERE related.canonicalTerm <> $term
       RETURN DISTINCT related.canonicalTerm AS term, related.layer AS layer,
              related.aiResistance AS aiResistance, related.vertical AS vertical,
              length(path) AS distance
       ORDER BY distance ASC, related.aiResistance DESC
       LIMIT $limit`,
      { term: canonicalTerm, limit: neo4j.int(limit) }
    );
    return result.records.map((r) => ({
      term: r.get("term"),
      layer: r.get("layer"),
      aiResistance: r.get("aiResistance")?.toNumber?.() ?? r.get("aiResistance") ?? 50,
      vertical: r.get("vertical"),
    }));
  } finally {
    await session.close();
  }
}

/**
 * SKILL PATH QUERY: Shortest path between two skills
 * "What do I need to learn to get from HHA to Registered Nurse?"
 */
export async function findSkillPath(
  fromTerm: string,
  toTerm: string
): Promise<string[]> {
  const session = driver.session({ database: process.env.NEO4J_DATABASE });
  try {
    const result = await session.run(
      `MATCH path = shortestPath(
         (a:Skill {canonicalTerm: $from})-[:HAS_CHILD|RELATED_TO*..6]-(b:Skill {canonicalTerm: $to})
       )
       RETURN [n IN nodes(path) | n.canonicalTerm] AS skills`,
      { from: fromTerm, to: toTerm }
    );
    if (result.records.length === 0) return [];
    return result.records[0].get("skills");
  } finally {
    await session.close();
  }
}

/**
 * AI DISPLACEMENT QUERY: Find skills at risk in a given vertical
 */
export async function getAIVulnerableSkills(
  vertical: string,
  threshold: number = 50
): Promise<GraphSkill[]> {
  const session = driver.session({ database: process.env.NEO4J_DATABASE });
  try {
    const result = await session.run(
      `MATCH (s:Skill)
       WHERE (s.vertical = $vertical OR s.vertical IS NULL)
         AND s.aiResistance < $threshold
         AND s.layer = 'canonical'
       RETURN s.canonicalTerm AS term, s.layer AS layer, s.aiResistance AS aiResistance, s.vertical AS vertical
       ORDER BY s.aiResistance ASC`,
      { vertical, threshold: neo4j.int(threshold) }
    );
    return result.records.map((r) => ({
      term: r.get("term"),
      layer: r.get("layer"),
      aiResistance: r.get("aiResistance")?.toNumber?.() ?? r.get("aiResistance") ?? 50,
      vertical: r.get("vertical"),
    }));
  } finally {
    await session.close();
  }
}

/**
 * Get high AI-resistance skills (AI-proof recommendations)
 */
export async function getAIProofSkills(
  excludeTerms: string[],
  limit: number = 10
): Promise<GraphSkill[]> {
  const session = driver.session({ database: process.env.NEO4J_DATABASE });
  try {
    const result = await session.run(
      `MATCH (s:Skill)
       WHERE s.layer = 'canonical'
         AND s.aiResistance >= 75
         AND NOT s.canonicalTerm IN $exclude
       RETURN s.canonicalTerm AS term, s.layer AS layer, s.aiResistance AS aiResistance, s.vertical AS vertical
       ORDER BY s.aiResistance DESC
       LIMIT $limit`,
      { exclude: excludeTerms, limit: neo4j.int(limit) }
    );
    return result.records.map((r) => ({
      term: r.get("term"),
      layer: r.get("layer"),
      aiResistance: r.get("aiResistance")?.toNumber?.() ?? r.get("aiResistance") ?? 50,
      vertical: r.get("vertical"),
    }));
  } finally {
    await session.close();
  }
}
