#!/bin/bash
#
# Manual disaster-recovery backup of the shared Neon Postgres.
# Drops a gzipped pg_dump under ~/Documents/payranker-docs/backups/.
#
# Usage:  cd ~/workpath && bash scripts/backup-postgres.sh
#
# Run anytime — before risky migrations, before schema changes,
# before YC interview, before paid pilots go live.
#
# Restore: see DISASTER_RECOVERY.md.

set -euo pipefail

cd "$(dirname "$0")/.."

# Pull DATABASE_URL from .env (so this works without env priming).
if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: DATABASE_URL not set. Source .env first or export it." >&2
  exit 1
fi

# Confirm pg_dump is on PATH. Neon uses Postgres 16; pg_dump >= 14 works
# but newer is better.
if ! command -v pg_dump >/dev/null 2>&1; then
  echo "ERROR: pg_dump not found. Install with:" >&2
  echo "  brew install postgresql@16  (macOS)" >&2
  echo "  sudo apt-get install postgresql-client-16  (Linux)" >&2
  exit 1
fi

BACKUP_DIR="$HOME/Documents/payranker-docs/backups"
mkdir -p "$BACKUP_DIR"

STAMP=$(date -u +%Y%m%dT%H%M%SZ)
OUT="$BACKUP_DIR/neon-$STAMP.sql.gz"

echo "Dumping to $OUT ..."
pg_dump \
  --no-owner \
  --no-privileges \
  --clean \
  --if-exists \
  --format=plain \
  "$DATABASE_URL" \
  | gzip > "$OUT"

SIZE=$(/usr/bin/stat -f%z "$OUT" 2>/dev/null || /usr/bin/stat -c%s "$OUT")
echo "Done: $OUT ($SIZE bytes)"

# Sanity check: verify gzip integrity + show row counts for the key tables.
gunzip -t "$OUT"
echo ""
echo "Spot check — key tables:"
psql "$DATABASE_URL" -c "
SELECT
  (SELECT COUNT(*) FROM \"User\")                AS users,
  (SELECT COUNT(*) FROM \"UserSkill\")           AS user_skills,
  (SELECT COUNT(*) FROM \"AnalyticsEvent\")      AS analytics_events;
" 2>/dev/null || echo "  (psql not available or schema missing; backup file is still valid)"

# Keep the last 30 local snapshots; prune older.
ls -1t "$BACKUP_DIR"/neon-*.sql.gz 2>/dev/null | tail -n +31 | xargs -r rm -f
echo ""
echo "Local retention: keeping last 30 snapshots in $BACKUP_DIR"
