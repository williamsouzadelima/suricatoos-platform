#!/usr/bin/env bash
# ============================================================================
# Suricatoos — disk hygiene + low-space guard
#
# Mitigates the platform's #1 observed outage: disk fills → PostgreSQL PANIC →
# crash-recovery loop → login 401. This reclaims space SAFELY (never touches app
# data or running images) and exits non-zero when free space is still low, so a
# cron job surfaces it (cron mails non-zero output) before the box wedges.
#
# What it reclaims (all safe): dangling/unused images, build cache, stopped
# containers, and oversized systemd journals. It does NOT delete DB rows,
# volumes, or tagged images in use — engagement data is never touched.
#
# Cron (every 6h):
#   0 */6 * * *  /opt/suricatoos/scripts/disk-hygiene.sh >> /var/log/suricatoos-disk.log 2>&1
# ============================================================================
set -uo pipefail

WARN_FREE_GB="${DISK_WARN_FREE_GB:-8}"   # warn (exit 1) below this
CRIT_FREE_GB="${DISK_CRIT_FREE_GB:-4}"   # critical (exit 2) below this
MOUNT="${DISK_MOUNT:-/}"

log() { echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] $*"; }
RT="$(command -v podman >/dev/null 2>&1 && echo podman || echo docker)"
free_gb() { df -BG --output=avail "$MOUNT" 2>/dev/null | tail -1 | tr -dc '0-9'; }

before="$(free_gb)"
log "Free on ${MOUNT} before: ${before}GB"

log "Pruning dangling images…";        "$RT" image prune -f >/dev/null 2>&1 || true
log "Pruning build cache…";            "$RT" builder prune -f >/dev/null 2>&1 || true
log "Pruning stopped containers…";     "$RT" container prune -f >/dev/null 2>&1 || true
if command -v journalctl >/dev/null 2>&1; then
  log "Vacuuming systemd journal to 200M…"; journalctl --vacuum-size=200M >/dev/null 2>&1 || true
fi

after="$(free_gb)"
log "Free on ${MOUNT} after:  ${after}GB (reclaimed $(( ${after:-0} - ${before:-0} ))GB)"

if [ -n "$after" ] && [ "$after" -lt "$CRIT_FREE_GB" ]; then
  log "CRITICAL: ${after}GB free (< ${CRIT_FREE_GB}GB) — Postgres is at risk of a disk-full PANIC. Grow the disk or archive flow logs NOW."
  exit 2
fi
if [ -n "$after" ] && [ "$after" -lt "$WARN_FREE_GB" ]; then
  log "WARNING: ${after}GB free (< ${WARN_FREE_GB}GB)."
  exit 1
fi
log "OK."
