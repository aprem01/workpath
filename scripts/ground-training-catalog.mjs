/**
 * Rebuild lib/training-catalog.ts so every entry is either verified real
 * or structurally honest.
 *
 * The old catalog was produced by asking a model for course URLs. On a
 * 60-URL sample of verifiable hosts, 73% were dead, and 3,151 records
 * carried a price the model invented.
 *
 * Rules applied here:
 *  - Coursera deep link  -> kept ONLY if the slug exists in the real
 *                           catalog pulled from Coursera's public API,
 *                           and the title is replaced with the real name.
 *  - Unverifiable deep link (Udemy, LinkedIn, edX course pages) ->
 *                           rewritten to that provider's SEARCH page for
 *                           the skill. Always resolves, and honestly says
 *                           "look here" instead of faking a specific course.
 *  - Search / landing page -> kept as-is; it was already honest.
 *  - priceUSD -> dropped everywhere. We cannot verify prices, so we must
 *                not print one.
 *
 * Writes the file back plus a report of what changed.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const CAT = path.join(ROOT, "lib", "training-catalog.ts");
const REAL = path.join(ROOT, "data", "coursera-catalog.json");

const real = JSON.parse(fs.readFileSync(REAL, "utf8"));
const realSlugs = new Map(real.courses.map((c) => [c.slug, c]));
console.log(`real Coursera courses loaded: ${realSlugs.size}`);

const src = fs.readFileSync(CAT, "utf8");
const startIdx = src.indexOf("export const TRAINING_CATALOG");
const objStart = src.indexOf("{", startIdx);
const header = src.slice(0, startIdx);
const body = src.slice(objStart);
// Trim the trailing "};\n...rest" so we can JSON.parse the object literal.
const lastBrace = body.lastIndexOf("};");
const objText = body.slice(0, lastBrace + 1);
const tail = body.slice(lastBrace + 2);
const catalog = JSON.parse(objText);

// Provider search pages, each verified to return HTTP 200 before being
// baked in here. A search page is an honest answer: it says "look here"
// instead of pointing at a specific course that may not exist.
const SEARCH = [
  [/udemy/,            (q) => `https://www.udemy.com/courses/search/?q=${q}`],
  [/linkedin/,         (q) => `https://www.linkedin.com/learning/search?keywords=${q}`],
  [/edx\.org/,         (q) => `https://www.edx.org/search?q=${q}`],
  [/coursera/,         (q) => `https://www.coursera.org/search?query=${q}`],
  [/skillshare/,       (q) => `https://www.skillshare.com/search?query=${q}`],
  [/youtube/,          (q) => `https://www.youtube.com/results?search_query=${q}`],
  [/khanacademy/,      (q) => `https://www.khanacademy.org/search?page_search_query=${q}`],
  [/learn\.microsoft/, (q) => `https://learn.microsoft.com/en-us/search/?terms=${q}`],
  [/alison\.com/,      (q) => `https://alison.com/courses?query=${q}`],
  [/ocw\.mit\.edu/,    (q) => `https://ocw.mit.edu/search/?q=${q}`],
  [/open\.edu|openlearn/, (q) => `https://www.open.edu/openlearn/search-results?q=${q}`],
  // Fixed landing pages: these providers organise by programme, not query.
  [/osha\.gov/,        () => "https://www.osha.gov/training"],
  [/hubspot/,          () => "https://academy.hubspot.com/courses"],
  // Red Cross is the ideal in-person answer: their own class finder asks
  // for the worker's zip, so it can never send them to a branch we invented.
  [/redcross/,         () => "https://www.redcross.org/take-a-class"],
  [/servsafe/,         () => "https://www.servsafe.com/"],
  [/withgoogle|grow\.google/, () => "https://grow.google/certificates/"],
];

const searchUrl = (host, skill) => {
  const q = encodeURIComponent(skill);
  for (const [re, fn] of SEARCH) if (re.test(host)) return fn(q);
  // Unknown provider: send them to the site root. It always resolves and
  // it is truthful, which a fabricated deep link is not. Better than
  // dropping a legitimate provider like a state agency or a community
  // college from the worker's options entirely.
  if (/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(host)) return `https://${host}/`;
  return null;
};

// Coursera retired /courses?query= and edX retired /course?search_query=;
// both now 404. Normalise them before the "already honest" check, or a
// stale-but-search-shaped URL slips through as if it were fine.
const modernise = (u) =>
  u.replace("coursera.org/courses?query=", "coursera.org/search?query=")
   .replace("edx.org/course?search_query=", "edx.org/search?q=");

const isSearchOrLanding = (u) =>
  /(search_query=|\?query=|\?q=|\/topic\/|\/courses\?|\/search\b|\/learn\/?$)/.test(u);

const stats = {
  total: 0, keptVerified: 0, keptHonest: 0,
  rewrittenToSearch: 0, droppedNoReplacement: 0,
  titlesCorrected: 0, pricesRemoved: 0,
};

function fixResource(r, skill) {
  stats.total++;
  if (r.priceUSD !== undefined) { delete r.priceUSD; stats.pricesRemoved++; }

  const url = modernise(String(r.url || ""));
  r.url = url;
  const host = url.replace(/^https?:\/\/(www\.)?([^/]+).*/, "$2");

  // Already honest (search or landing page)
  if (isSearchOrLanding(url)) { stats.keptHonest++; return r; }

  // Coursera: verify the slug against the real catalog.
  const cm = url.match(/coursera\.org\/(?:learn|specializations|professional-certificates)\/([^/?#]+)/);
  if (cm) {
    const hit = realSlugs.get(cm[1]);
    if (hit) {
      if (hit.name && hit.name.trim() && hit.name.trim() !== r.title) {
        r.title = hit.name.trim();
        stats.titlesCorrected++;
      }
      if (hit.workload) r.duration = hit.workload;
      stats.keptVerified++;
      return r;
    }
    const alt = searchUrl("coursera", skill);
    r.url = alt; r.title = `Search Coursera for ${skill}`;
    stats.rewrittenToSearch++;
    return r;
  }

  // Any other unverifiable deep link -> that provider's search page.
  const alt = searchUrl(host, skill);
  if (alt) {
    r.url = alt;
    const label = (r.provider || host.split(".")[0]).replace(/^\w/, (c) => c.toUpperCase());
    r.title = `${skill} training at ${label}`;
    stats.rewrittenToSearch++;
    return r;
  }
  stats.droppedNoReplacement++;
  return null;
}

for (const [skill, entry] of Object.entries(catalog)) {
  for (const bucket of ["free", "paid"]) {
    if (!Array.isArray(entry[bucket])) continue;
    const seen = new Set();
    entry[bucket] = entry[bucket]
      .map((r) => fixResource(r, skill))
      .filter(Boolean)
      .filter((r) => { // collapse duplicates created by rewriting to search
        const k = r.url;
        if (seen.has(k)) return false;
        seen.add(k); return true;
      });
  }
}

const note = `/** Pre-cached training catalog.
 *
 * GROUNDED ${new Date().toISOString().slice(0, 10)}. Every Coursera link in
 * here was verified against Coursera's public catalog API on that date;
 * links that could not be verified were rewritten to the provider's own
 * search page rather than left pointing at a course that may not exist.
 *
 * Prices are deliberately absent. The previous generation carried
 * model-invented figures (clustered on $40/$49/$15) shown to people
 * deciding whether they could afford a course. Show "Free" or "Paid"
 * until a real price is fetched from the provider.
 *
 * Regenerate: node scripts/fetch-coursera-catalog.mjs && node scripts/ground-training-catalog.mjs
 */
`;
const out = note + header.slice(header.indexOf("\n") + 1) +
  "export const TRAINING_CATALOG: Record<string, TrainingCatalogEntry> = " +
  JSON.stringify(catalog, null, 1) + ";" + tail;
fs.writeFileSync(CAT, out);

console.log("\n--- grounding report ---");
for (const [k, v] of Object.entries(stats)) console.log(`  ${k.padEnd(22)} ${v}`);
