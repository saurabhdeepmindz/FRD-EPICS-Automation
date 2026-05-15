# PostgreSQL Backups — `prd_generator`

This directory holds compressed PostgreSQL dumps of the working
`prd_generator` database. Files are named `prd_generator-YYYYMMDD-HHMM.sql.gz`.

## What's in the dump

The dumps committed here are produced with `pg_dump -F p --clean
--if-exists` plus **data exclusions** for two high-volume tables:

| Excluded table          | Why                                                                      |
|-------------------------|--------------------------------------------------------------------------|
| `ba_skill_executions`   | Raw AI prompt/response logs. Tens of MB per row; not needed to rebuild.  |
| `ba_screens`            | Base64 screen-capture blobs. Replayable from `wireframes/` source files. |

**Schema for both tables is still included**, so a restored DB has the
correct shape — those tables will simply be empty after restore.

Everything else (BaProject, BaModule, BaArtifact, BaArtifactSection,
BaSubTask, BaPseudoFile, BaLldConfig, BaUser, etc.) is dumped in full.

## How to restore

```bash
# Stop the backend first so no connection holds open the DB.
# Drop + recreate the target DB:
PGPASSWORD=prd_secret dropdb -h localhost -U prd_user prd_generator
PGPASSWORD=prd_secret createdb -h localhost -U prd_user prd_generator

# Restore (the dump already carries DROP IF EXISTS for every object):
gunzip -c prd_generator-YYYYMMDD-HHMM.sql.gz \
  | PGPASSWORD=prd_secret psql -h localhost -U prd_user -d prd_generator
```

PowerShell equivalent:

```powershell
$env:PGPASSWORD = 'prd_secret'
dropdb -h localhost -U prd_user prd_generator
createdb -h localhost -U prd_user prd_generator
# 7-Zip can pipe gunzip on Windows, or just gunzip the file first.
gzip -d -k prd_generator-YYYYMMDD-HHMM.sql.gz
psql -h localhost -U prd_user -d prd_generator -f prd_generator-YYYYMMDD-HHMM.sql
```

## How to take a new backup

```bash
TS=$(date +%Y%m%d-%H%M)
PGPASSWORD=prd_secret pg_dump -h localhost -U prd_user -d prd_generator \
  -F p --clean --if-exists \
  --exclude-table-data=ba_skill_executions \
  --exclude-table-data=ba_screens \
  -f "backups/db-backup/prd_generator-${TS}.sql"
gzip -9 "backups/db-backup/prd_generator-${TS}.sql"
git add "backups/db-backup/prd_generator-${TS}.sql.gz"
```

PowerShell equivalent:

```powershell
$ts = Get-Date -Format 'yyyyMMdd-HHmm'
$env:PGPASSWORD = 'prd_secret'
& "C:\Program Files\PostgreSQL\18\bin\pg_dump.exe" `
  -h localhost -U prd_user -d prd_generator `
  -F p --clean --if-exists `
  --exclude-table-data=ba_skill_executions `
  --exclude-table-data=ba_screens `
  -f "backups/db-backup/prd_generator-$ts.sql"
gzip -9 "backups/db-backup/prd_generator-$ts.sql"
git add "backups/db-backup/prd_generator-$ts.sql.gz"
```

## Size guardrails

- GitHub hard limit: **100 MB** per file.
- GitHub warning: 50 MB per file.
- With the exclusions above the gzipped dump should stay under **15 MB** as
  long as `ba_pseudo_files`, `ba_artifact_sections`, and `ba_subtask_sections`
  don't grow disproportionately.

If a future dump exceeds 50 MB, investigate which table grew and either
add it to `--exclude-table-data` or move backups to Git LFS / external
storage instead of forcing them into the repo.

Raw uncompressed `.sql` dumps are gitignored — only `.sql.gz` is tracked.
