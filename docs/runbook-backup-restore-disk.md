# Runbook — Backups, Restore & Disk (DR + the #1 outage)

Addresses two CRITICAL audit findings: **no backups / no restore procedure**, and
the recurring **disk-full → Postgres-PANIC → login-401** loop on the single host.

All paths assume the production layout: Podman, the `pgvector` container, the app
at `/opt/suricatoos`, DB name/user from `.env` (`SURICATOOS_POSTGRES_DB/USER`).

---

## 1. Backups

`scripts/backup-db.sh` dumps the DB to a timestamped `.sql.gz`, rotates to the last
`BACKUP_RETAIN` (default 7), refuses to run below `BACKUP_MIN_FREE_GB` free, and can
ship off-host.

**Schedule (daily 03:30):**
```cron
30 3 * * *  /opt/suricatoos/scripts/backup-db.sh >> /var/log/suricatoos-backup.log 2>&1
```

> ⚠️ **On-host backups do not survive disk loss.** Set an off-host destination or
> the backup protects against nothing that matters on a single box:
> ```
> BACKUP_REMOTE=user@backup-host:/backups  /opt/suricatoos/scripts/backup-db.sh
> ```
> or wire the S3 block in the script. The host is disk-constrained, so prefer
> ship-and-delete (point `BACKUP_DIR` at a small staging dir + `BACKUP_REMOTE`).

**Test-restore monthly** (proves the backup is valid without touching prod):
```bash
podman exec pgvector createdb -U postgres suricatoos_restore_test
RESTORE_DB=suricatoos_restore_test ./scripts/restore-db.sh /path/to/latest.sql.gz
# spot-check row counts, then: podman exec pgvector dropdb -U postgres suricatoos_restore_test
```

**Long-term (strategic):** WAL archiving + PITR, and a standby replica on a second
host — out of scope for these scripts but the real target for a product holding
client engagement data.

---

## 2. Restore (DR)

```bash
./scripts/restore-db.sh /opt/suricatoos-data/backups/suricatoos-suricatoosdb-YYYYMMDD-HHMMSS.sql.gz
# add --force to skip the confirm prompt
```
Destructive: overwrites the target DB. The script stops the app during restore and
restarts it after. Verify afterward: HTTPS 200, login works, recent flows present.

---

## 3. Disk — the recurring outage

**Symptom:** login returns 401 "invalid login or password" with the RIGHT password,
because Postgres is in crash-recovery after a disk-full PANIC (the user lookup hits
`the database system is in recovery mode`). **So a login that "stopped working" with
no salt/cookie change = check disk FIRST, not the credential.**

**Prevent (cron every 6h):**
```cron
0 */6 * * *  /opt/suricatoos/scripts/disk-hygiene.sh >> /var/log/suricatoos-disk.log 2>&1
```
`disk-hygiene.sh` reclaims safely (dangling images, build cache, stopped containers,
journal vacuum — never DB data) and exits non-zero when free space is still low so
cron surfaces it. Wire the alerts in `observability/vmalert/` for proactive warning.

**Recover (when it's already wedged):**
```bash
./scripts/disk-hygiene.sh           # reclaim space
podman restart pgvector             # ready in ~6s once space is free
# verify: a WRONG-password login should now return a bcrypt mismatch,
# NOT a recovery-mode error.
```

**Root cause (not yet fixed — needs a decision):** `msglogs`/`termlogs` grow
unbounded (a single flow can hold 16k–24k rows). Do NOT blindly auto-delete — the
migrated engagement flows are intentionally retained. Options: per-row size CHECK
constraints (after auditing `max(octet_length(...))` so existing rows don't violate),
partition by flow/quarter + archive cold partitions off-host, or grow the disk.
