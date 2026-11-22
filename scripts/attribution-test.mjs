/**
 * Tests for lib/attribution.ts. Run: node scripts/attribution-test.mjs
 *
 * There is no test runner in this repo yet, so this is deliberately
 * dependency-free: it transpiles the TypeScript with the local compiler
 * and imports it from memory.
 */
import { readFileSync } from "node:fs";
import ts from "typescript";

const src = readFileSync(new URL("../lib/attribution.ts", import.meta.url), "utf8");
const js = ts.transpileModule(src, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const m = await import("data:text/javascript;base64," + Buffer.from(js).toString("base64"));
const {
  parseAttribution, serializeAttribution, deserializeAttribution,
  attributionFromCookieHeader, describeAttribution, ATTR_COOKIE,
} = m;

let pass = 0; const fails = [];
const t = (name, cond) => { if (cond) pass++; else fails.push(name); };

// An organic visit must not burn the first-touch slot.
t("organic -> null", parseAttribution("") === null);
t("junk params -> null", parseAttribution("?foo=bar&ref=x") === null);

// Campaign capture.
const a = parseAttribution("?utm_source=google&utm_medium=cpc&utm_campaign=chi-hha", {
  landing: "/employer?x=1", referrer: "https://www.google.com/search?q=a",
});
t("source", a.source === "google");
t("medium", a.medium === "cpc");
t("campaign", a.campaign === "chi-hha");
t("landing drops query", a.landing === "/employer");
t("referrer is host only", a.referrer === "www.google.com");
t("ts is a date", typeof a.ts === "string" && !Number.isNaN(Date.parse(a.ts)));

// A click id alone is enough to record.
for (const [k, v] of [["gclid","ABC123"],["fbclid","XYZ"],["li_fat_id","99"],["msclkid","M1"],["ttclid","T1"]]) {
  const got = parseAttribution(`?${k}=${v}`);
  t(`${k} captured`, got && got[k] === v);
}

// Round trip through a Cookie header with neighbours.
const cookie = serializeAttribution(a);
t("serializes", typeof cookie === "string");
const back = attributionFromCookieHeader(`other=1; ${ATTR_COOKIE}=${cookie}; third=2`);
t("round trip source", back.source === "google");
t("round trip campaign", back.campaign === "chi-hha");
t("round trip ts survives allowlist", back.ts === a.ts);
t("round trip landing survives allowlist", back.landing === "/employer");

// Fails soft on anything malformed. A conversion must never be lost to
// a measurement bug.
t("null cookie", attributionFromCookieHeader(null) === null);
t("absent cookie", attributionFromCookieHeader("a=1; b=2") === null);
t("truncated json", attributionFromCookieHeader(`${ATTR_COOKIE}=%7B%22ts%22`) === null);
t("not json", attributionFromCookieHeader(`${ATTR_COOKIE}=hello`) === null);
t("json without ts", deserializeAttribution(encodeURIComponent('{"source":"x"}')) === null);
t("array json", deserializeAttribution(encodeURIComponent("[1,2,3]")) === null);

// Hostile sizes.
t("field capped", parseAttribution("?utm_campaign=" + "z".repeat(9000)).campaign.length === 200);
let many = "?gclid=" + "a".repeat(200);
for (const k of ["utm_source","utm_medium","utm_campaign","utm_term","utm_content","fbclid","li_fat_id","msclkid","ttclid"]) {
  many += `&${k}=` + "b".repeat(200);
}
t("oversized cookie refused, not truncated",
  serializeAttribution(parseAttribution(many, { landing: "/" + "c".repeat(400) })) === null);

// Injection. These values reach an HTML email, so they must not survive
// the way in, and must not survive a hand-written cookie either.
const payloads = [
  '<img src=x onerror=alert(1)>',
  '<script>alert(1)</script>',
  '"><b>bold</b>',
  "'; DROP TABLE jobs;--",
  'a\r\nBcc: attacker@example.com',
];
for (const p of payloads) {
  const got = parseAttribution(`?utm_source=${encodeURIComponent(p)}`);
  const v = got?.source ?? "";
  t(`payload stripped on the way in: ${p.slice(0, 22)}`, !/[<>"'\r\n;]/.test(v));
}
for (const p of payloads) {
  const forged = encodeURIComponent(JSON.stringify({ ts: "2026-11-22T00:00:00.000Z", source: p }));
  const got = deserializeAttribution(forged);
  const v = got?.source ?? "";
  t(`payload stripped from a forged cookie: ${p.slice(0, 22)}`, !/[<>"'\r\n;]/.test(v));
}
t("describe output is inert",
  !/[<>]/.test(describeAttribution(parseAttribution('?utm_source=<script>&utm_medium=cpc') ?? null)));

// A malformed referrer is not worth recording and must not throw.
const mr = parseAttribution("?utm_source=x", { referrer: "not a url" });
t("bad referrer ignored", mr.referrer === undefined && mr.source === "x");

// Human summary.
t("describe utm", describeAttribution(a) === "google / cpc / chi-hha");
t("describe gclid", describeAttribution(parseAttribution("?gclid=ABC123")) === "gclid present");
t("describe null", describeAttribution(null) === "direct / none");

console.log(`${pass} passed, ${fails.length} failed`);
for (const f of fails) console.log("  FAIL:", f);
process.exit(fails.length ? 1 : 0);
