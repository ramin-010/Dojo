#!/usr/bin/env node
/**
 * One-time repair of legacy day-bucket rows.
 *
 *   node scripts/fix-legacy-date-encoding.mjs            # dry run (default)
 *   node scripts/fix-legacy-date-encoding.mjs --apply    # actually write
 *
 * ── The problem ──────────────────────────────────────────────────────
 * Day-bucketed columns are supposed to hold a DAY LABEL: UTC midnight of
 * the IST calendar day (see src/lib/date.ts). Rows written before
 * getISTMidnight() was applied consistently instead stored the real
 * instant IST midnight occurs — 18:30:00 on the *previous* UTC day.
 *
 * So a single IST day can appear twice:
 *   2026-08-15 18:30:00   (legacy encoding of IST 2026-08-16)
 *   2026-08-16 00:00:00   (correct label for IST 2026-08-16)
 *
 * Any trend analysis over this data double-counts those days.
 *
 * ── The repair ───────────────────────────────────────────────────────
 * Shift legacy rows +5:30 so they land on the correct label. Where that
 * collides with an existing correct row (same IST day recorded twice),
 * merge the pair: keep the richer record, delete the other.
 *
 * Richness is scored, not assumed — see scoreRow(). In this dataset the
 * decisive signal is that "Skipped via Triage" is the auto-generated
 * fallback written when no explicit outcome was given, so a row carrying
 * a real hand-typed remark always describes what actually happened.
 */

import 'dotenv/config';
import pg from 'pg';

const APPLY = process.argv.includes('--apply');

const TRIAGE_BOILERPLATE = /^skipped via triage$/i;

/** Higher score == the record we keep. */
function scoreRow(r) {
  let score = 0;
  const remark = (r.remark || '').trim();

  // A real, hand-written remark is the strongest evidence that this row
  // reflects a deliberate log rather than an automatic fallback.
  if (remark && !TRIAGE_BOILERPLATE.test(remark)) score += 4;

  // A terminal status beats a stale ACTIVE/UPCOMING row that was never resolved.
  if (['COMPLETED', 'SKIPPED', 'PARTIAL'].includes(r.status)) score += 2;

  // An explicit COMPLETED outranks a bare SKIPPED: triage could auto-skip
  // blocks the user never touched, so SKIPPED-with-no-remark is the weaker claim.
  if (r.status === 'COMPLETED') score += 1;

  score += Math.min(remark.length, 200) / 1000; // length as a tiebreak only
  return score;
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set.');
  await client.connect();

  console.log(APPLY ? '\n*** APPLY MODE — changes will be written ***\n'
                    : '\n--- DRY RUN (pass --apply to write) ---\n');

  await client.query('BEGIN');
  try {
    await fixSlots();
    await fixSimple('DayDebrief', 'date');
    await fixSimple('Revision', 'scheduledFor');
    await fixSimple('DailyHistory', 'date');
    await fixSimple('BlockSessionLog', 'date');

    if (APPLY) {
      await client.query('COMMIT');
      console.log('\nCommitted.\n');
      await verify();
    } else {
      await client.query('ROLLBACK');
      console.log('\nRolled back (dry run). Re-run with --apply to keep these changes.\n');
    }
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    await client.end();
  }
}

/** DailyScheduleSlot has @@unique([sourceBlockId, date]), so shifts can collide. */
async function fixSlots() {
  const { rows: pairs } = await client.query(`
    SELECT
      l.id AS legacy_id, l.status AS legacy_status, l.remark AS legacy_remark,
      l."minutesDone" AS legacy_minutes, l.title,
      to_char(l.date,'YYYY-MM-DD HH24:MI') AS legacy_ts,
      g.id AS proper_id, g.status AS proper_status, g.remark AS proper_remark,
      g."minutesDone" AS proper_minutes,
      to_char(g.date,'YYYY-MM-DD HH24:MI') AS proper_ts
    FROM "DailyScheduleSlot" l
    JOIN "DailyScheduleSlot" g
      ON g.id <> l.id
     AND g."sourceBlockId" = l."sourceBlockId"
     AND g.date = l.date + interval '5:30'
    WHERE l.date::time = '18:30:00'
    ORDER BY l.date, l.title
  `);

  console.log(`DailyScheduleSlot — ${pairs.length} duplicate pair(s) to merge:\n`);

  let keptLegacy = 0;
  for (const p of pairs) {
    const legacy = { status: p.legacy_status, remark: p.legacy_remark };
    const proper = { status: p.proper_status, remark: p.proper_remark };
    const legacyWins = scoreRow(legacy) > scoreRow(proper);
    if (legacyWins) keptLegacy++;

    const differs = legacy.status !== proper.status ||
                    (legacy.remark || '') !== (proper.remark || '');
    const flag = differs ? '  <-- differs' : '';
    console.log(`  ${p.legacy_ts} -> ${p.proper_ts}  ${p.title}${flag}`);
    console.log(`     keep ${legacyWins ? 'LEGACY' : 'PROPER'}: ` +
                `${(legacyWins ? legacy : proper).status} ` +
                `"${((legacyWins ? legacy : proper).remark || '').slice(0, 55)}"`);

    if (legacyWins) {
      // Promote the legacy record's content onto the correctly-dated row,
      // then drop the legacy row. Updating the survivor (rather than moving
      // the legacy row onto the label) keeps the unique index satisfied at
      // every point without needing a temporary date.
      await client.query(
        `UPDATE "DailyScheduleSlot"
            SET status = $1, remark = $2, "minutesDone" = $3
          WHERE id = $4`,
        [p.legacy_status, p.legacy_remark, p.legacy_minutes, p.proper_id]
      );
    }
    await client.query(`DELETE FROM "DailyScheduleSlot" WHERE id = $1`, [p.legacy_id]);
  }

  console.log(`\n  merged ${pairs.length} pair(s); legacy record kept in ${keptLegacy}\n`);

  // Any legacy rows with no counterpart just shift onto the correct label.
  const { rowCount: shifted } = await client.query(`
    UPDATE "DailyScheduleSlot" SET date = date + interval '5:30'
    WHERE date::time = '18:30:00'
  `);
  console.log(`  shifted ${shifted} non-colliding slot row(s)\n`);
}

/** Tables where the +5:30 shift cannot collide (verified before running). */
async function fixSimple(table, column) {
  const { rows: [{ n }] } = await client.query(
    `SELECT count(*)::int AS n FROM "${table}" WHERE "${column}"::time = '18:30:00'`
  );
  if (n === 0) {
    console.log(`${table}.${column} — nothing to fix`);
    return;
  }
  const { rowCount } = await client.query(
    `UPDATE "${table}" SET "${column}" = "${column}" + interval '5:30'
      WHERE "${column}"::time = '18:30:00'`
  );
  console.log(`${table}.${column} — shifted ${rowCount} row(s)`);
}

async function verify() {
  const { rows } = await client.query(`
    SELECT tbl, to_char(d,'HH24:MI:SS') AS time_part, count(*)::int AS rows
    FROM (
      SELECT 'DailyScheduleSlot' tbl, date d FROM "DailyScheduleSlot"
      UNION ALL SELECT 'BlockSessionLog', date FROM "BlockSessionLog"
      UNION ALL SELECT 'DayDebrief', date FROM "DayDebrief"
      UNION ALL SELECT 'Revision', "scheduledFor" FROM "Revision"
      UNION ALL SELECT 'DailyHistory', date FROM "DailyHistory"
    ) x GROUP BY tbl, time_part ORDER BY tbl, time_part
  `);
  console.log('Post-fix encoding check (every row should read 00:00:00):');
  console.table(rows);
  const bad = rows.filter(r => r.time_part !== '00:00:00');
  if (bad.length) {
    console.error('WARNING: non-midnight buckets remain.');
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error('\nFAILED:', err.message);
  process.exit(1);
});
