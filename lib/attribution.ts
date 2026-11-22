/**
 * First-touch attribution, first-party only.
 *
 * Why this exists: paid traffic is worthless to measure after the fact.
 * A click that lands on payranker.io on Monday and contacts us on Friday
 * is unattributable unless something recorded the campaign on Monday.
 * Ad platforms solve this with their own pixels; we do not use those
 * (see /cookies — no cross-site tracking, no third-party advertising),
 * so we record the campaign ourselves, in our own cookie, and attach it
 * to the conversion when it happens.
 *
 * First touch wins: once the cookie is set it is not overwritten, so a
 * visitor who arrives from an ad and returns later via Google still
 * credits the ad. Last-touch would credit the brand search the ad caused.
 *
 * Nothing here identifies a person. The click ids are opaque strings the
 * ad networks put in the landing URL; they become identifiable only if
 * uploaded back to those networks, which we do not do. If that ever
 * changes, the cookie notice has to change with it.
 */

export const ATTR_COOKIE = "pr_attr";
export const ATTR_MAX_AGE_DAYS = 90;

/** One field, so a hostile query string cannot bloat the cookie. */
const MAX_FIELD = 200;
/** Whole cookie. Browsers drop cookies over ~4KB; stay far under. */
const MAX_COOKIE = 1500;

export type Attribution = {
  /** ISO timestamp of first touch. */
  ts: string;
  /** Path only — never the query string, which can carry PII. */
  landing?: string;
  /** Referring hostname only, not the full URL. */
  referrer?: string;
  source?: string;
  medium?: string;
  campaign?: string;
  term?: string;
  content?: string;
  /** Ad-network click ids, as they appeared in the landing URL. */
  gclid?: string;
  fbclid?: string;
  li_fat_id?: string;
  msclkid?: string;
  ttclid?: string;
};

const UTM_KEYS = [
  ["utm_source", "source"],
  ["utm_medium", "medium"],
  ["utm_campaign", "campaign"],
  ["utm_term", "term"],
  ["utm_content", "content"],
] as const;

const CLICK_IDS = [
  "gclid",
  "fbclid",
  "li_fat_id",
  "msclkid",
  "ttclid",
] as const;

/**
 * Characters allowed in a campaign value or click id.
 *
 * Every field here arrives in the landing URL's query string, so it is
 * attacker-controlled, and it ends up interpolated into the notification
 * email we read. Output escaping is the real defence (see escapeHtml at
 * each call site); this allowlist is the second layer, so a payload
 * never reaches the cookie in the first place. Real campaign names and
 * the networks' click ids use only these characters.
 */
const SAFE_FIELD = /[^A-Za-z0-9 _.\-~+%:/|]/g;

function clean(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined;
  const v = String(raw).replace(SAFE_FIELD, "").trim().slice(0, MAX_FIELD);
  return v || undefined;
}

/**
 * Build an Attribution from a landing URL's query string.
 *
 * Returns null when there is nothing worth recording — no campaign and no
 * click id. An organic visit should not burn a cookie, and should not
 * occupy the first-touch slot that a later ad click deserves.
 */
export function parseAttribution(
  search: string,
  opts: { landing?: string; referrer?: string } = {}
): Attribution | null {
  let params: URLSearchParams;
  try {
    params = new URLSearchParams(search || "");
  } catch {
    return null;
  }

  const attr: Attribution = { ts: new Date().toISOString() };
  let found = false;

  for (const [param, field] of UTM_KEYS) {
    const v = clean(params.get(param));
    if (v) {
      (attr as Record<string, unknown>)[field] = v;
      found = true;
    }
  }
  for (const key of CLICK_IDS) {
    const v = clean(params.get(key));
    if (v) {
      (attr as Record<string, unknown>)[key] = v;
      found = true;
    }
  }

  if (!found) return null;

  // Drop the query string before cleaning, not after: "?" is not in the
  // allowlist, so cleaning first would strip the separator and fold the
  // query into the path ("/employer?x=1" -> "/employerx1").
  const landing = clean(String(opts.landing ?? "").split("?")[0]);
  if (landing) attr.landing = landing.slice(0, MAX_FIELD);

  // Likewise parse the referrer before cleaning — a URL needs "?" and
  // "//" intact — and keep only the hostname.
  const ref = String(opts.referrer ?? "").trim();
  if (ref) {
    try {
      attr.referrer = clean(new URL(ref).hostname);
    } catch {
      /* a malformed referrer is not worth recording */
    }
  }

  return attr;
}

/** Serialize for the cookie. Returns null if it would be too large. */
export function serializeAttribution(attr: Attribution): string | null {
  const json = JSON.stringify(attr);
  if (json.length > MAX_COOKIE) return null;
  return encodeURIComponent(json);
}

/**
 * Read an Attribution back out of a raw cookie value.
 *
 * Fails soft, always: a conversion must never be lost because the cookie
 * was truncated, hand-edited, or written by an older version of this file.
 */
export function deserializeAttribution(raw: string | null | undefined): Attribution | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(raw));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    if (typeof (parsed as Attribution).ts !== "string") return null;
    // Re-clean every field. A cookie can be hand-written, so a value that
    // was never passed through clean() on the way in must not be trusted
    // on the way out.
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof v !== "string") continue;
      const safe = clean(v);
      if (safe) out[k] = safe;
    }
    if (!out.ts) return null;
    return out as unknown as Attribution;
  } catch {
    return null;
  }
}

/**
 * Pull attribution off an incoming request's Cookie header.
 * Server-side counterpart to the client capture component.
 */
export function attributionFromCookieHeader(header: string | null | undefined): Attribution | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() !== ATTR_COOKIE) continue;
    return deserializeAttribution(part.slice(eq + 1).trim());
  }
  return null;
}

/**
 * A one-line human summary, for an email notification or an admin list.
 * "google / cpc / chicago-hha" beats a JSON blob at 7am.
 */
export function describeAttribution(attr: Attribution | null): string {
  if (!attr) return "direct / none";
  const trio = [attr.source, attr.medium, attr.campaign].filter(Boolean);
  if (trio.length) return trio.join(" / ");
  for (const key of CLICK_IDS) {
    if (attr[key]) return `${key} present`;
  }
  return attr.referrer ? `referral / ${attr.referrer}` : "direct / none";
}
