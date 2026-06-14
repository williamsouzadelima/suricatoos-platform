#!/usr/bin/env bash
# ============================================================================
# Suricatoos — PostgreSQL restore (DR)
#
# Restores a gzipped pg_dump produced by backup-db.sh into the pgvector
# database. DESTRUCTIVE: it drops and recreates the target schema's objects as
# the dump replays, so it overwrites current data. Requires explicit --force
# (or an interactive "yes") to proceed.
#
# Usage:
#   ./scripts/restore-db.sh /opt/suricatoos-data/backups/suricatoos-suricatoosdb-YYYYMMDD-HHMMSS.sql.gz
#   ./scripts/restore-db.sh --force <file>     # skip the confirmation prompt
#
# Test-restore (recommended monthly): restore into a SCRATCH db to verify the
# backup is valid without touching prod:
#   RESTORE_DB=suricatoos_restore_test ./scripts/restore-db.sh <file>
#   (create it first: podman exec pgvector createdb -U postgres suricatoos_restore_test)
# ============================================================================
set -euo pipefail

cd "$(dirname "$0")/.."
[ -f .env ] && set -a && . ./.env && set +a || true

FORCE=0
if [ "${1:-}" = "--force" ]; then FORCE=1; shift; fi
FILE="${1:-}"

PG_CONTAINER="${PG_CONTAINER:-pgvector}"
PG_USER="${SURICATOOS_POSTGRES_USER:-postgres}"
RESTORE_DB="${RESTORE_DB:-${SURICATOOS_POSTGRES_DB:-suricatoosdb}}"

log() { echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] $*"; }
RT="$(command -v podman >/dev/null 2>&1 && echo podman || echo docker)"

if [ -z "$FILE" ] || [ ! -f "$FILE" ]; then
  echo "Usage: $0 [--force] <backup.sql.gz>   (file not found: '${FILE}')" >&2
  exit 2
fi

log "About to restore '${FILE}' INTO database '${RESTORE_DB}' (container ${PG_CONTAINER})."
log "This OVERWRITES data in '${RESTORE_DB}'."
if [ "$FORCE" -ne 1 ]; then
  read -r -p "Type 'yes' to proceed: " ans
  [ "$ans" = "yes" ] || { log "Aborted."; exit 1; }
fi

# Stop the app first so it isn't writing mid-restore (best-effort).
if [ -f docker-compose.yml ]; then
  log "Stopping the app container during restore (best-effort)…"
  "$RT" compose -f docker-compose.yml stop suricatoos 2>/dev/null || true
fi

log "Restoring… (errors from DROP of nonexistent objects are normal)"
gunzip -c "$FILE" | "$RT" exec -i "$PG_CONTAINER" psql -v ON_ERROR_STOP=0 -U "$PG_USER" "$RESTORE_DB"
log "Restore stream complete."

if [ -f docker-compose.yml ]; then
  log "Starting the app container…"
  "$RT" compose -f docker-compose.yml up -d --no-deps suricatoos 2>/dev/null || true
fi

log "Done. Verify: app health (HTTPS 200), row counts, recent flows present."
