#!/usr/bin/env bash
# ============================================================================
# Suricatoos — PostgreSQL backup
#
# Dumps the pgvector database to a timestamped, gzipped file and rotates old
# backups. Addresses the audit's CRITICAL gap: the platform had NO backups.
#
# ⚠️ ON-HOST BACKUPS DO NOT SURVIVE DISK LOSS. The whole point of DR is an
#    OFF-HOST copy. Set BACKUP_REMOTE (an rsync/scp target) or wire the S3
#    block below — otherwise a disk failure loses both the DB and its backups.
#    The host is also disk-constrained (≈79 GB, recurring disk-full), so this
#    script refuses to dump when free space is below MIN_FREE_GB.
#
# Usage:
#   ./scripts/backup-db.sh                 # dump to $BACKUP_DIR, rotate
#   BACKUP_DIR=/mnt/ext ./scripts/backup-db.sh
#   BACKUP_REMOTE=user@host:/backups ./scripts/backup-db.sh   # ship off-host
#
# Cron (daily 03:30, log appended):
#   30 3 * * *  /opt/suricatoos/scripts/backup-db.sh >> /var/log/suricatoos-backup.log 2>&1
# ============================================================================
set -euo pipefail

cd "$(dirname "$0")/.."
[ -f .env ] && set -a && . ./.env && set +a || true

PG_CONTAINER="${PG_CONTAINER:-pgvector}"
PG_USER="${SURICATOOS_POSTGRES_USER:-postgres}"
PG_DB="${SURICATOOS_POSTGRES_DB:-suricatoosdb}"
BACKUP_DIR="${BACKUP_DIR:-/opt/suricatoos-data/backups}"
RETAIN="${BACKUP_RETAIN:-7}"          # keep the N most recent dumps
MIN_FREE_GB="${BACKUP_MIN_FREE_GB:-6}" # refuse to dump below this free space
BACKUP_REMOTE="${BACKUP_REMOTE:-}"     # rsync/scp target, e.g. user@host:/backups

log() { echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] $*"; }

container_runtime() { command -v podman >/dev/null 2>&1 && echo podman || echo docker; }
RT="$(container_runtime)"

mkdir -p "$BACKUP_DIR"

# Pre-flight: enough free space on the backup target's filesystem?
free_gb="$(df -BG --output=avail "$BACKUP_DIR" 2>/dev/null | tail -1 | tr -dc '0-9')"
if [ -n "$free_gb" ] && [ "$free_gb" -lt "$MIN_FREE_GB" ]; then
  log "ERROR: only ${free_gb}GB free at $BACKUP_DIR (< ${MIN_FREE_GB}GB). Refusing to dump — free space or point BACKUP_DIR off-host."
  exit 1
fi

ts="$(date -u '+%Y%m%d-%H%M%S')"
out="$BACKUP_DIR/suricatoos-${PG_DB}-${ts}.sql.gz"
tmp="${out}.partial"

log "Dumping ${PG_DB} from container ${PG_CONTAINER} via ${RT} → ${out}"
# --no-owner/--no-privileges keep the dump portable across roles on restore.
if ! "$RT" exec "$PG_CONTAINER" pg_dump -U "$PG_USER" --no-owner --no-privileges "$PG_DB" | gzip -c > "$tmp"; then
  log "ERROR: pg_dump failed; removing partial file."
  rm -f "$tmp"
  exit 1
fi
mv "$tmp" "$out"
size="$(du -h "$out" | cut -f1)"
log "Backup OK: ${out} (${size})"

# Off-host copy (strongly recommended — see header).
if [ -n "$BACKUP_REMOTE" ]; then
  log "Shipping off-host → ${BACKUP_REMOTE}"
  rsync -a "$out" "$BACKUP_REMOTE/" && log "Off-host copy OK" || log "WARNING: off-host copy FAILED"
fi
# S3 alternative (uncomment + configure):
#   aws s3 cp "$out" "s3://YOUR-BUCKET/suricatoos/" && log "S3 upload OK"

# Rotation: keep the N most recent local dumps.
mapfile -t old < <(ls -1t "$BACKUP_DIR"/suricatoos-"${PG_DB}"-*.sql.gz 2>/dev/null | tail -n +$((RETAIN + 1)))
for f in "${old[@]:-}"; do
  [ -n "$f" ] && { rm -f "$f"; log "Rotated out old backup: $f"; }
done

log "Done. Local backups retained: $(ls -1 "$BACKUP_DIR"/suricatoos-"${PG_DB}"-*.sql.gz 2>/dev/null | wc -l | tr -d ' ')"
