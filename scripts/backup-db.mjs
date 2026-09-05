#!/usr/bin/env node
/**
 * Full logical backup of the Revise database to a timestamped JSON file.
 *
 *   node scripts/backup-db.mjs
 *   node scripts/backup-db.mjs --out D:/backups --keep 60
 *
 * Deliberately written as plain .mjs against the `pg` driver rather than
 * Prisma or pg_dump, so it runs with bare `node` on a fresh machine and from
 * Task Scheduler / cron with no toolchain and no `prisma generate` step.
 *
 * It discovers tables from information_schema, so new models are picked up
 * automatically — you never have to remember to update this file.
 *
 * Restore is the inverse and is intentionally NOT automated here; see
 * prisma/MIGRATIONS.md before restoring anything.
 */

import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';

const args = process.argv.slice(2);
const argVal = (flag, fallback) => {
  const i = args.indexOf(flag);
  return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
};

const OUT_DIR = path.resolve(argVal('--out', 'backups'));
const KEEP = Number(argVal('--keep', '30'));

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set. Populate .env first.');
  process.exit(1);
}

// Serialise BIGINT/NUMERIC as strings rather than losing precision in JSON.
pg.types.setTypeParser(20, (v) => v);
pg.types.setTypeParser(1700, (v) => v);

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const outFile = path.join(OUT_DIR, `revise-backup-${stamp}.json`);

async function main() {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  try {
    const { rows: tables } = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);

    if (tables.length === 0) {
      throw new Error('No tables found in schema "public" — refusing to write an empty backup.');
    }

    const data = {};
    const counts = {};

    for (const { table_name: table } of tables) {
      // Table names come from information_schema, not user input, but quote
      // them anyway so mixed-case Prisma names ("DayDebrief") resolve.
      const { rows } = await client.query(`SELECT * FROM "${table}"`);
      data[table] = rows;
      counts[table] = rows.length;
    }

    const payload = {
      meta: {
        takenAt: new Date().toISOString(),
        database: new URL(process.env.DATABASE_URL).pathname.slice(1),
        host: new URL(process.env.DATABASE_URL).hostname,
        tableCount: tables.length,
        rowCounts: counts,
      },
      data,
    };

    fs.mkdirSync(OUT_DIR, { recursive: true });
    fs.writeFileSync(outFile, JSON.stringify(payload, null, 2), 'utf8');

    const totalRows = Object.values(counts).reduce((a, b) => a + b, 0);
    const sizeMb = (fs.statSync(outFile).size / 1024 / 1024).toFixed(2);

    console.log(`\nBackup written: ${outFile}`);
    console.log(`${tables.length} tables, ${totalRows} rows, ${sizeMb} MB\n`);

    for (const [table, n] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
      if (n > 0) console.log(`  ${String(n).padStart(6)}  ${table}`);
    }

    // A backup of zero rows across the board almost certainly means we pointed
    // at the wrong database. Surface that loudly rather than silently rotating
    // a good backup out in favour of an empty one.
    if (totalRows === 0) {
      console.error('\nWARNING: every table was empty. Check DATABASE_URL.');
      process.exitCode = 1;
      return;
    }

    pruneOldBackups();
  } finally {
    await client.end();
  }
}

function pruneOldBackups() {
  if (!Number.isFinite(KEEP) || KEEP <= 0) return;

  const existing = fs
    .readdirSync(OUT_DIR)
    .filter((f) => /^revise-backup-.*\.json$/.test(f))
    .sort()
    .reverse();

  const stale = existing.slice(KEEP);
  for (const f of stale) fs.unlinkSync(path.join(OUT_DIR, f));
  if (stale.length > 0) {
    console.log(`\nPruned ${stale.length} backup(s) older than the last ${KEEP}.`);
  }
}

main().catch((err) => {
  console.error('\nBackup FAILED:', err.message);
  process.exit(1);
});
