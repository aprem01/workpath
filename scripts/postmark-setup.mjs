/**
 * Set up Postmark sending domains and print the DNS records for Caroline.
 *
 * Postmark's Account API can create a domain and read back its DKIM and
 * Return-Path values, so the only manual step is creating the account.
 * Everything after that is here.
 *
 * Usage:
 *   POSTMARK_ACCOUNT_TOKEN=xxxx node scripts/postmark-setup.mjs
 *   POSTMARK_ACCOUNT_TOKEN=xxxx node scripts/postmark-setup.mjs --verify
 *
 * The account token is read from the environment and never printed.
 */
import process from "node:process";

const TOKEN = process.env.POSTMARK_ACCOUNT_TOKEN;
if (!TOKEN) {
  console.error(
    "POSTMARK_ACCOUNT_TOKEN not set.\n" +
    "Find it in Postmark under Account > API Tokens > Account API token\n" +
    "(this is NOT the Server token used for sending)."
  );
  process.exit(1);
}

const DOMAINS = ["payranker.io", "skilmatch.io"];
const VERIFY = process.argv.includes("--verify");
const API = "https://api.postmarkapp.com";

async function pm(path, method = "GET", body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      "X-Postmark-Account-Token": TOKEN,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  let json = {};
  try { json = text ? JSON.parse(text) : {}; } catch { json = { raw: text.slice(0, 200) }; }
  if (!res.ok) {
    throw new Error(`${method} ${path} -> ${res.status} ${json.Message || text.slice(0, 160)}`);
  }
  return json;
}

/** Find an existing domain by name, or create it. Idempotent by design: re-running must not duplicate. */
async function ensureDomain(name) {
  const list = await pm("/domains?count=200&offset=0");
  const found = (list.Domains || []).find(
    (d) => String(d.Name).toLowerCase() === name.toLowerCase()
  );
  if (found) return { id: found.ID, created: false };
  const made = await pm("/domains", "POST", { Name: name });
  return { id: made.ID, created: true };
}

function nameForNamecheap(host, domain) {
  // Namecheap's "Host" field takes the part BEFORE the domain. Postmark
  // returns a full hostname, so strip the domain and trailing dot.
  if (!host) return "";
  const h = host.replace(/\.$/, "");
  const suffix = `.${domain}`;
  return h.toLowerCase().endsWith(suffix) ? h.slice(0, -suffix.length) : h;
}

const results = [];
for (const domain of DOMAINS) {
  try {
    const { id, created } = await ensureDomain(domain);
    if (VERIFY) {
      try { await pm(`/domains/${id}/verifyDkim`, "PUT"); } catch { /* not yet in DNS */ }
      try { await pm(`/domains/${id}/verifyReturnPath`, "PUT"); } catch { /* not yet in DNS */ }
    }
    const d = await pm(`/domains/${id}`);
    results.push({ domain, id, created, d });
  } catch (e) {
    results.push({ domain, error: e.message });
  }
}

console.log("\n" + "=".repeat(70));
console.log("POSTMARK DOMAIN STATUS");
console.log("=".repeat(70));
for (const r of results) {
  if (r.error) { console.log(`\n${r.domain}: ERROR ${r.error}`); continue; }
  const d = r.d;
  console.log(`\n${r.domain}  (${r.created ? "created" : "already existed"})`);
  console.log(`  DKIM        : ${d.DKIMVerified ? "VERIFIED" : "pending"}`);
  console.log(`  Return-Path : ${d.ReturnPathDomainVerified ? "VERIFIED" : "pending"}`);
}

console.log("\n" + "=".repeat(70));
console.log("DNS RECORDS TO SEND CAROLINE  (Namecheap > Advanced DNS)");
console.log("=".repeat(70));
for (const r of results) {
  if (r.error) continue;
  const d = r.d;
  const dkimHost = d.DKIMPendingHost || d.DKIMHost;
  const dkimValue = d.DKIMPendingTextValue || d.DKIMTextValue;
  const rpHost = d.ReturnPathDomain || `pm-bounces.${r.domain}`;
  const rpValue = d.ReturnPathDomainCNAMEValue || "pm.mtasv.net";
  console.log(`\n${r.domain}`);
  if (d.DKIMVerified && d.ReturnPathDomainVerified) {
    console.log("  Nothing to add — both records are verified.");
    continue;
  }
  if (!d.DKIMVerified) {
    console.log(`  1) Type: TXT Record`);
    console.log(`     Host : ${nameForNamecheap(dkimHost, r.domain)}`);
    console.log(`     Value: ${dkimValue}`);
  }
  if (!d.ReturnPathDomainVerified) {
    console.log(`  2) Type: CNAME Record`);
    console.log(`     Host : ${nameForNamecheap(rpHost, r.domain)}`);
    console.log(`     Value: ${rpValue}`);
  }
}
console.log("\nTTL: Automatic. Do NOT change Mail Settings — forwarding stays as is.");
console.log("Once Caroline saves, re-run with --verify to confirm.\n");
