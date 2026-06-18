# BLS data ingestion — full-coverage path

The current `lib/wages.ts` and `lib/projections.ts` carry hand-seeded
data for the top 30 SOC codes (Caroline's beta cohort: Healthcare,
Sales, Logistics, Construction, Wellness, Hospitality, Admin, Finance).

To lift coverage to all 923 O*NET roles, we need a BLS Public Data API
key (free, 500 queries/day with key, vs 25/day unregistered).

## Get a key (5 min, free)

1. Go to https://data.bls.gov/registrationEngine/
2. Email + name. They email a confirmation key immediately.
3. Save the key in `.env` as `BLS_API_KEY=<your-key>`.

## Run the ingestor

```bash
cd ~/workpath
npx tsx scripts/ingest-bls.ts
```

Output overwrites `lib/wages.ts` and `lib/projections.ts` with full
923-SOC coverage. Idempotent — re-run when BLS publishes new annual
data (typically May).

## How the script works

The BLS V2 API takes 50 series per call. We have 923 SOCs × 2 series
each (wage + projection) = 1,846 series → 37 calls. Well within the
500/day budget.

OEWS series ID format for national wage:
- `OEUN0000000000000000<SOC>0004` — Annual mean wage
- `OEUN0000000000000000<SOC>0007` — Annual median wage
- `<SOC>` is the 6-digit SOC (e.g. "291141" for RN)

OEWS series ID format for Chicago MSA wage:
- `OEUM<area>0000000<SOC>0007` where area = `0016974` for Chicago MSA

Employment Projections series ID:
- `EPUU<SOC>000` — total employment

The script:
1. Iterates `TAXONOMY` to collect all socCodes
2. Batches into 50-series calls
3. Posts to `https://api.bls.gov/publicAPI/v2/timeseries/data/`
4. Parses response, builds the `WAGES` and `PROJECTIONS` records
5. Falls back to National wage when Chicago metro is suppressed
6. Writes both files

## Why we did the hand-seed first

Caroline is shipping screenshots for YC interview prep. The 30 seeded
SOCs cover ~70% of what beta testers and target users will search,
which is more than enough to validate the wage-benchmark UI feature
without waiting on the BLS API gauntlet.

When the user provides `BLS_API_KEY`, run the script to take coverage
from 30 → 923 in a single batch. Both files get regenerated; no
downstream code changes needed.
