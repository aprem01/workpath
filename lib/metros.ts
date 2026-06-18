/**
 * US metros supported by PayRanker — Phase 4 (geographic expansion).
 *
 * Each metro carries:
 *  - the Adzuna `where` parameter (matches Adzuna's geocoding)
 *  - the BLS MSA code for wage lookup (future: load Chicago-equivalent
 *    wage data per metro from BLS OEWS)
 *  - the ZIP-prefix range it covers (used for auto-detect from the
 *    user's profile zip)
 *
 * Today: Chicago is the canonical MVP. Other metros use National BLS
 * wage data until we ingest per-metro OEWS in scripts/ingest-bls.ts.
 */

export interface Metro {
  /** URL-safe slug used in localStorage + querystrings */
  id: string;
  /** Human-facing label */
  label: string;
  /** Adzuna `where` parameter */
  adzunaWhere: string;
  /** BLS MSA code (CBSA-based) for OEWS wage lookup */
  blsAreaCode: string;
  /** ZIP-3 prefixes that geographically belong to this metro */
  zipPrefixes: string[];
}

export const METROS: Metro[] = [
  {
    id: "chicago",
    label: "Chicago, IL",
    adzunaWhere: "Chicago",
    blsAreaCode: "0016974",
    zipPrefixes: ["606", "604", "601", "602", "603", "605"],
  },
  {
    id: "nyc",
    label: "New York City, NY",
    adzunaWhere: "New York",
    blsAreaCode: "0035620",
    zipPrefixes: ["100", "101", "102", "103", "104", "112", "113", "114", "116"],
  },
  {
    id: "la",
    label: "Los Angeles, CA",
    adzunaWhere: "Los Angeles",
    blsAreaCode: "0031080",
    zipPrefixes: ["900", "901", "902", "903", "904", "905", "906", "907", "908", "910", "911", "912"],
  },
  {
    id: "dfw",
    label: "Dallas-Fort Worth, TX",
    adzunaWhere: "Dallas",
    blsAreaCode: "0019100",
    zipPrefixes: ["750", "751", "752", "753", "754", "760", "761", "762"],
  },
  {
    id: "houston",
    label: "Houston, TX",
    adzunaWhere: "Houston",
    blsAreaCode: "0026420",
    zipPrefixes: ["770", "771", "772", "773", "774", "775"],
  },
  {
    id: "atlanta",
    label: "Atlanta, GA",
    adzunaWhere: "Atlanta",
    blsAreaCode: "0012060",
    zipPrefixes: ["300", "301", "302", "303", "311", "312"],
  },
  {
    id: "miami",
    label: "Miami, FL",
    adzunaWhere: "Miami",
    blsAreaCode: "0033100",
    zipPrefixes: ["330", "331", "332", "333"],
  },
  {
    id: "phoenix",
    label: "Phoenix, AZ",
    adzunaWhere: "Phoenix",
    blsAreaCode: "0038060",
    zipPrefixes: ["850", "851", "852", "853"],
  },
];

export const DEFAULT_METRO_ID = "chicago";

export function getMetroById(id: string | null | undefined): Metro | null {
  if (!id) return null;
  return METROS.find((m) => m.id === id) || null;
}

/**
 * Best-effort metro detection from a 5-digit US ZIP.
 * Falls back to Chicago when no ZIP-prefix match exists.
 */
export function detectMetroFromZip(zip: string | null | undefined): Metro {
  if (!zip || zip.length < 3) {
    return getMetroById(DEFAULT_METRO_ID)!;
  }
  const prefix = zip.slice(0, 3);
  for (const metro of METROS) {
    if (metro.zipPrefixes.includes(prefix)) return metro;
  }
  return getMetroById(DEFAULT_METRO_ID)!;
}
