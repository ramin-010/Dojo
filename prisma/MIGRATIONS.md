# Database migrations & backups

## Read this first

**Your local `.env` `DATABASE_URL` points at the production Neon database.**

That was survivable while the project used `prisma db push`. Now that migrations
exist, it is not. **Never run `prisma migrate dev` while `.env` points at
production** — `migrate dev` is a development command that will offer to *reset*
(drop and recreate) the database when it detects drift, and it can take that
action against whatever URL it is given.

Rules:

| Command | Safe against production? |
|---|---|
| `npx prisma migrate status` | Yes — read-only |
| `npx prisma migrate deploy` | Yes — this is the production command |
| `npx prisma migrate diff` | Yes — read-only |
| `npx prisma migrate dev` | **NO — can reset the database** |
| `npx prisma migrate reset` | **NO — destroys all data** |
| `npx prisma db push` | No — bypasses migration history; don't use any more |

The safest fix is a second database for development (Neon branches are free and
instant: branch `main`, point a local `.env.development.local` at the branch URL,
and do all `migrate dev` work there). Until that exists, treat every schema
change as a production change and follow the flow below.

---

## Current state

The schema was baselined on 2026-09-05. Before that, the project ran on
`prisma db push`, so there was no migration history at all — a schema edit had
no `down`, no audit trail, and no way to replay against a fresh database.

- `prisma/migrations/0_init/migration.sql` — generated from the schema as it
  stood at baseline time, and marked applied with `prisma migrate resolve`.
  It was **not** executed against the database; the tables already existed and
  a drift check (`migrate diff --from-config-datasource --to-schema`) came back
  empty, confirming the SQL matches production exactly.

Do not edit `0_init/migration.sql`. It represents history.

---

## Making a schema change

1. **Back up first.**

   ```bash
   npm run db:backup
   ```

2. **Edit `prisma/schema.prisma`.**

3. **Generate the migration without executing it.** This writes the SQL by
   diffing the recorded migration history against your edited schema, and never
   touches the database:

   ```bash
   mkdir -p prisma/migrations/$(date +%Y%m%d%H%M%S)_describe_the_change
   npx prisma migrate diff \
     --from-migrations prisma/migrations \
     --to-schema prisma/schema.prisma \
     --script > prisma/migrations/<that_folder>/migration.sql
   ```

4. **Read the generated SQL.** Every time. Look specifically for `DROP COLUMN`,
   `DROP TABLE`, and any `ALTER COLUMN ... SET NOT NULL` on a table that already
   has rows — Prisma will happily generate a migration that discards data when
   you rename a field, because a rename is indistinguishable from a drop plus an
   add. If you meant a rename, replace the generated SQL with an
   `ALTER TABLE ... RENAME COLUMN ...` by hand.

5. **Apply it.**

   ```bash
   npx prisma migrate deploy
   npx prisma generate
   ```

6. **Verify.**

   ```bash
   npx prisma migrate status
   ```

---

## Backups

```bash
npm run db:backup                        # -> ./backups, keeps the last 30
node scripts/backup-db.mjs --out D:/backups --keep 60
```

`scripts/backup-db.mjs` is deliberately plain `.mjs` over the `pg` driver, so it
runs with bare `node` — no `tsx`, no `prisma generate`, no `pg_dump` install. It
discovers tables from `information_schema`, so new models are included
automatically. Output is a single timestamped JSON file with a `meta.rowCounts`
summary; it exits non-zero if every table came back empty (which almost always
means the wrong `DATABASE_URL`).

`backups/` is gitignored — the files contain real personal data. Keep at least
one copy off this machine.

### Schedule it (Windows Task Scheduler)

```powershell
$action  = New-ScheduledTaskAction -Execute "node" `
  -Argument "scripts\backup-db.mjs" -WorkingDirectory "E:\PERSONAL_PROJECTS\revise"
$trigger = New-ScheduledTaskTrigger -Daily -At 2am
Register-ScheduledTask -TaskName "Revise DB Backup" -Action $action -Trigger $trigger
```

### Also turn on Neon's own protection

The JSON dump is a logical backup and a convenience. Neon additionally offers
point-in-time restore and instant branching, which recover from cases a nightly
JSON file cannot (a bad migration at 3pm, for example). Check the retention
window on your Neon plan and raise it if it is shorter than a week.

---

## Restoring

There is intentionally no automated restore script — an unattended restore is
how a bad afternoon becomes an unrecoverable one. To restore:

1. Create a **new** Neon branch. Never restore over a live database.
2. Point a scratch `DATABASE_URL` at it and run `npx prisma migrate deploy`.
3. Insert the rows from the backup JSON in foreign-key order: `User`,
   `Workspace`, `Subject`, `NoteCategory`, `Topic`, `Tag`, `_TagToTopic`,
   `Capture`, `Attachment`, `Reminder`, `TimeBlock`, then the log tables
   (`Revision`, `ActivityLog`, `DailyHistory`, `SubjectStreak`, `Habit`,
   `BlockSessionLog`, `DailyScheduleSlot`, `QuickNote`, `DayDebrief`,
   `TopicMention`, `TopicCaptureLink`).
4. Verify row counts against `meta.rowCounts` in the backup file.
5. Only then repoint the app.
