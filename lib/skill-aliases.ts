/**
 * Curated bidirectional skill aliases for the Chicago launch verticals.
 *
 * Why this exists (Caroline 9/11, P1): `expandWithSynonyms` is derived
 * from O*NET and is asymmetric — "Personal Care Assistance" expands to
 * five variants, but "Caregiving" expands to only itself. So a jobseeker
 * who typed "Caregiving" never matched a Skilmatch job requiring
 * "Personal Care Assistance", and the two-sided marketplace looked
 * broken even though both sides had the right data.
 *
 * Each GROUP is a set of terms that mean the same thing to an employer.
 * Matching is bidirectional: any member matches any other member.
 *
 * This is deliberately a hand-curated list, not a model. It is small,
 * auditable, and explainable — a recruiter can be told exactly why a
 * candidate matched. The durable fix is an embedding over the skill
 * vocabulary, which closes holes we haven't hand-written yet; this map
 * is the deterministic version that ships today.
 */

const GROUPS: string[][] = [
  // ── Home health / senior care (launch vertical) ──
  [
    "caregiving", "caregiver", "care giving", "personal care assistance",
    "personal care", "personal care aide", "home health assistance",
    "home health aide", "home care", "in-home care", "elder care",
    "elderly care", "senior care", "patient care", "hha", "pca",
    "activities of daily living support", "adl support", "daily living assistance",
  ],
  [
    "companionship", "companion care", "companion", "in-home companion",
    "social companionship", "emotional support", "companionship & emotional support",
  ],
  [
    "meal preparation", "meal prep", "food preparation", "cooking",
    "preparing meals", "meal planning",
  ],
  [
    "mobility assistance", "ambulation assistance", "transfer assistance",
    "walking assistance", "mobility support", "lifting and transferring",
  ],
  [
    "vital signs monitoring", "vital signs", "taking vitals",
    "blood pressure monitoring", "monitoring vital signs", "vitals",
  ],
  [
    "medication reminders", "medication management", "medication administration",
    "medication assistance", "med reminders",
  ],
  [
    "light housekeeping", "housekeeping", "homemaking", "light cleaning",
    "home cleaning", "tidying",
  ],
  [
    "transportation assistance", "driving clients", "client transportation",
    "errands", "transportation", "running errands",
  ],
  [
    "bathing assistance", "hygiene assistance", "grooming assistance",
    "personal hygiene", "toileting assistance", "dressing assistance",
  ],
  ["dementia care", "memory care", "alzheimer's care", "alzheimers care", "cognitive care"],
  ["hha certification", "home health aide certification", "hha license", "hha certified"],
  ["cna", "certified nursing assistant", "cna license", "cna certification"],
  ["cpr", "cpr certification", "cpr certified", "first aid", "cpr / first aid", "cpr and first aid"],
  ["care plan documentation", "charting", "care documentation", "progress notes", "emr charting"],
  ["wound care", "wound care basics", "dressing changes"],
  ["behavioral de-escalation", "de-escalation", "behavior management", "crisis de-escalation"],

  // ── Spoken languages ──
  // A worker who picks a language in the bilingual picker stores it as
  // "Spanish (Spoken)". Employers write the same thing as "Bilingual
  // Spanish" or "Spanish Speaking". These groups make the two meet.
  ["bilingual english", "english", "english (spoken)", "english fluency", "english language", "english speaker", "english speaking", "fluent in english"],
  ["bilingual spanish", "fluent in spanish", "spanish", "spanish (spoken)", "spanish fluency", "spanish language", "spanish speaker", "spanish speaking"],
  ["bilingual chinese", "chinese", "chinese (mandarin)", "chinese (mandarin) (spoken)", "chinese (spoken)", "chinese fluency", "chinese language", "chinese speaker", "chinese speaking", "fluent in chinese"],
  ["bilingual mandarin", "fluent in mandarin", "mandarin", "mandarin (spoken)", "mandarin fluency", "mandarin language", "mandarin speaker", "mandarin speaking"],
  ["bilingual french", "fluent in french", "french", "french (spoken)", "french fluency", "french language", "french speaker", "french speaking"],
  ["bilingual vietnamese", "fluent in vietnamese", "vietnamese", "vietnamese (spoken)", "vietnamese fluency", "vietnamese language", "vietnamese speaker", "vietnamese speaking"],
  ["arabic", "arabic (spoken)", "arabic fluency", "arabic language", "arabic speaker", "arabic speaking", "bilingual arabic", "fluent in arabic"],
  ["bilingual polish", "fluent in polish", "polish", "polish (spoken)", "polish fluency", "polish language", "polish speaker", "polish speaking"],
  ["bilingual russian", "fluent in russian", "russian", "russian (spoken)", "russian fluency", "russian language", "russian speaker", "russian speaking"],
  ["bilingual tagalog", "fluent in tagalog", "tagalog", "tagalog (spoken)", "tagalog fluency", "tagalog language", "tagalog speaker", "tagalog speaking"],
  ["bilingual german", "fluent in german", "german", "german (spoken)", "german fluency", "german language", "german speaker", "german speaking"],
  ["bilingual korean", "fluent in korean", "korean", "korean (spoken)", "korean fluency", "korean language", "korean speaker", "korean speaking"],
  ["bilingual portuguese", "fluent in portuguese", "portuguese", "portuguese (spoken)", "portuguese fluency", "portuguese language", "portuguese speaker", "portuguese speaking"],
  ["bilingual hindi", "fluent in hindi", "hindi", "hindi (spoken)", "hindi fluency", "hindi language", "hindi speaker", "hindi speaking"],
  ["bilingual urdu", "fluent in urdu", "urdu", "urdu (spoken)", "urdu fluency", "urdu language", "urdu speaker", "urdu speaking"],
  ["bilingual italian", "fluent in italian", "italian", "italian (spoken)", "italian fluency", "italian language", "italian speaker", "italian speaking"],
  ["bilingual haitian creole", "fluent in haitian creole", "haitian creole", "haitian creole (spoken)", "haitian creole fluency", "haitian creole language", "haitian creole speaker", "haitian creole speaking"],
  ["bilingual somali", "fluent in somali", "somali", "somali (spoken)", "somali fluency", "somali language", "somali speaker", "somali speaking"],
  ["bengali", "bengali (spoken)", "bengali fluency", "bengali language", "bengali speaker", "bengali speaking", "bilingual bengali", "fluent in bengali"],

  // ── Retail / customer-facing ──
  ["retail sales", "sales associate", "sales", "store associate", "floor sales"],
  ["cash handling", "cash register", "pos systems", "point of sale", "register operation"],
  ["visual merchandising", "merchandising", "product display", "store displays"],
  ["customer service", "client relations", "customer support", "customer relations", "guest service"],
  ["inventory management", "stock management", "inventory control", "stocking"],

  // ── Logistics / transport ──
  ["logistics", "logistics coordination", "supply chain", "distribution"],
  ["warehouse", "warehouse operations", "warehouse associate", "fulfillment"],
  ["forklift", "forklift operation", "forklift certification", "forklift certified"],
  ["driving", "delivery driving", "delivery", "courier", "driver"],
  ["cdl", "cdl license", "commercial drivers license", "cdl class a"],

  // ── Food service ──
  ["food safety", "servsafe", "food handling", "food safety certification"],
  ["line cook", "cook", "kitchen", "prep cook"],
];

/** term (lowercased) → canonical group id */
const TERM_TO_GROUP = new Map<string, number>();
GROUPS.forEach((group, i) => {
  for (const term of group) TERM_TO_GROUP.set(term.toLowerCase().trim(), i);
});

/**
 * All curated aliases for a term, including the term itself.
 * Returns just [term] when the term isn't in the curated map.
 */
export function expandWithAliases(term: string): string[] {
  const key = term.toLowerCase().trim();
  const gid = TERM_TO_GROUP.get(key);
  if (gid === undefined) return [term];
  return [term, ...GROUPS[gid]];
}

/** Do two skill terms refer to the same thing under the curated map? */
export function aliasMatch(a: string, b: string): boolean {
  const ga = TERM_TO_GROUP.get(a.toLowerCase().trim());
  const gb = TERM_TO_GROUP.get(b.toLowerCase().trim());
  return ga !== undefined && ga === gb;
}
