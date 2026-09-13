'use server';

import { prisma } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { startOfDay } from 'date-fns';
import { getISTMidnight, fromISTDateString, toISTDateString } from '@/lib/date';
import { getSession } from '@/lib/auth';
import { SlotStatus, BlockStatus, Prisma } from '@prisma/client';

export interface SlotLogInput {
  slotId: string;
  sourceBlockId: string | null;
  status: SlotStatus;
  remark?: string | null;
  minutesDone?: number | null;
  actualStartTime?: string | null;
  actualEndTime?: string | null;
}

export interface SaveDebriefInput {
  id?: string;
  /**
   * Accepted for backwards compatibility with existing callers but IGNORED —
   * the workspace is taken from the session. A client-supplied workspaceId on
   * a server action is attacker controlled.
   */
  workspaceId?: string;
  date: Date;
  
  // Layer 1
  blocksPlanned: number;
  blocksCompleted: number;
  blocksSkipped: number;
  totalFocusedMin: number;

  // Layer 2
  energy?: number | null;
  focus?: number | null;
  mood?: number | null;
  tags?: string[];
  narrative?: string | null;
  tomorrowIntent?: string | null;

  // Layer 3
  freeWrite?: string | null;

  // Layer 4 (New: End of Day Logging)
  slotLogs?: SlotLogInput[];
}

export async function getDebriefForDate(_ignoredWorkspaceId: string | null, date: Date) {
  const { workspaceId } = await getSession();
  const normalizedDate = getISTMidnight(new Date(date));
  
  try {
    const debrief = await prisma.dayDebrief.findUnique({
      where: {
        workspaceId_date: {
          workspaceId,
          date: normalizedDate,
        },
      },
    });
    return { success: true, debrief };
  } catch (error) {
    console.error('Failed to get debrief:', error);
    return { success: false, error: 'Failed to fetch debrief' };
  }
}

export async function saveDebrief(data: SaveDebriefInput) {
  const { workspaceId } = await getSession();
  const normalizedDate = getISTMidnight(new Date(data.date));

  try {
    const debrief = await prisma.$transaction(async (tx) => {
      // 1. Save Debrief
      const debriefResult = await tx.dayDebrief.upsert({
        where: {
          workspaceId_date: {
            workspaceId,
            date: normalizedDate,
          },
        },
        create: {
          workspaceId,
          date: normalizedDate,
          blocksPlanned: data.blocksPlanned,
          blocksCompleted: data.blocksCompleted,
          blocksSkipped: data.blocksSkipped,
          totalFocusedMin: data.totalFocusedMin,
          energy: data.energy,
          focus: data.focus,
          mood: data.mood,
          tags: data.tags || [],
          narrative: data.narrative,
          tomorrowIntent: data.tomorrowIntent,
          freeWrite: data.freeWrite,
        },
        update: {
          blocksPlanned: data.blocksPlanned,
          blocksCompleted: data.blocksCompleted,
          blocksSkipped: data.blocksSkipped,
          totalFocusedMin: data.totalFocusedMin,
          energy: data.energy,
          focus: data.focus,
          mood: data.mood,
          tags: data.tags || [],
          narrative: data.narrative,
          tomorrowIntent: data.tomorrowIntent,
          freeWrite: data.freeWrite,
        },
      });

      // 2. Process bulk slot logs
      if (data.slotLogs && data.slotLogs.length > 0) {
        // Slot ids come from the client. updateMany with a workspace filter
        // makes a foreign id a no-op instead of a cross-tenant write.
        for (const log of data.slotLogs) {
          await tx.dailyScheduleSlot.updateMany({
            where: { id: log.slotId, workspaceId },
            data: {
              status: log.status,
              remark: log.remark,
              minutesDone: log.minutesDone,
              actualStartTime: log.actualStartTime,
              actualEndTime: log.actualEndTime,
            }
          });

          // Generate BlockSessionLog if it has a source block and it reached a terminal state
          if (log.sourceBlockId && (log.status === 'COMPLETED' || log.status === 'SKIPPED' || log.status === 'PARTIAL')) {
            const blockStatus: BlockStatus = log.status === 'SKIPPED' ? 'SKIPPED' : (log.status === 'PARTIAL' ? 'PARTIAL' : 'COMPLETED');
            
            await tx.blockSessionLog.upsert({
              where: {
                timeBlockId_date: {
                  timeBlockId: log.sourceBlockId,
                  date: normalizedDate,
                }
              },
              update: {
                status: blockStatus,
                remark: log.remark,
                minutesDone: log.minutesDone
              },
              create: {
                timeBlockId: log.sourceBlockId,
                date: normalizedDate,
                status: blockStatus,
                remark: log.remark,
                minutesDone: log.minutesDone
              }
            });
          }
        }
      }

      return debriefResult;
    });

    revalidatePath('/dashboard');
    return { success: true, debrief };
  } catch (error) {
    console.error('Failed to save debrief:', error);
    return { success: false, error: 'Failed to save debrief' };
  }
}

// ====================================================================
// MULTI-DAY CATCH-UP SAVE
// ====================================================================

export async function saveMultiDayCatchUp(input: {
  /** Ignored — the workspace comes from the session. */
  workspaceId?: string;
  dates: string[];
  sharedContext: {
    energy: number;
    focus: number;
    mood: number;
    tags: string[];
    narrative: string;
  };
  slotUpdates: Array<{
    slotId: string;
    sourceBlockId: string | null;
    status: 'COMPLETED' | 'SKIPPED';
    remark?: string;
  }>;
}) {
  const { workspaceId } = await getSession();

  try {
    const normalizedDates = input.dates.map(fromISTDateString);

    // Defensive backstop: the client already resolves every block to
    // COMPLETED or SKIPPED before sending (see MultiDayCatchUpModal), but a
    // malformed request shouldn't be able to smuggle anything else through.
    const explicitUpdates = input.slotUpdates.filter(
      u => u.status === 'COMPLETED' || u.status === 'SKIPPED'
    );

    // ── Reads first, outside any transaction ────────────────────────────
    // A Postgres interactive transaction holds a dedicated connection open
    // for its whole duration and Prisma caps that at a 5s default timeout.
    // The original version did every lookup AND every write inside one
    // transaction — a findFirst/update/upsert per block per date — which
    // for a week-long gap (6 dates x 6 blocks) meant 100+ sequential round
    // trips against Neon and blew straight through that timeout. The
    // transaction rolled back silently (P2028), the action correctly
    // returned {success:false}, and the client — which didn't check that
    // flag — showed "Catch-up saved!" and closed anyway. Nothing was ever
    // written. Plain (non-transactional) reads have no such timeout, so
    // everything that only *decides* what to write happens here; the
    // transaction below contains nothing but the writes themselves.
    const [existingDebriefs, allSlotsInRange] = await Promise.all([
      prisma.dayDebrief.findMany({
        where: { workspaceId, date: { in: normalizedDates } },
        select: { date: true },
      }),
      // Covers the whole date range, not just the blocks being updated —
      // this doubles as the source for the final per-date stats below, so
      // there's no need to re-read after writing.
      prisma.dailyScheduleSlot.findMany({
        where: { workspaceId, date: { in: normalizedDates } },
      }),
    ]);

    const existingDebriefDates = new Set(existingDebriefs.map(d => d.date.getTime()));
    const newDebriefDates = normalizedDates.filter(d => !existingDebriefDates.has(d.getTime()));
    const slotById = new Map(allSlotsInRange.map(s => [s.id, s]));

    // Slot status writes, grouped by (status, remark). In the common case
    // every block in the batch shares the same status (SKIPPED) and no
    // remark, so this is one write for the whole batch; a per-block
    // exception adds one group each.
    type SlotGroup = { status: 'COMPLETED' | 'SKIPPED'; remark: string | null; ids: string[] };
    const slotGroups = new Map<string, SlotGroup>();
    const newStatusById = new Map<string, 'COMPLETED' | 'SKIPPED'>();
    for (const update of explicitUpdates) {
      // A slot id belonging to someone else, or outside this date range,
      // simply isn't in `slotById` and is skipped rather than written to.
      const slot = slotById.get(update.slotId);
      if (!slot) continue;
      const remark = update.remark || null;
      const key = `${update.status}|${remark ?? ''}`;
      const group = slotGroups.get(key) ?? { status: update.status, remark, ids: [] };
      group.ids.push(slot.id);
      slotGroups.set(key, group);
      newStatusById.set(slot.id, update.status);
    }

    // BlockSessionLog targets, split into create-vs-update via one lookup.
    const logTargets: { timeBlockId: string; date: Date; status: BlockStatus; remark: string | null }[] = [];
    for (const update of explicitUpdates) {
      const slot = slotById.get(update.slotId);
      if (!slot?.sourceBlockId) continue;
      logTargets.push({
        timeBlockId: slot.sourceBlockId,
        date: slot.date,
        status: update.status === 'SKIPPED' ? 'SKIPPED' : 'COMPLETED',
        remark: update.remark || null,
      });
    }

    const logsToCreate: typeof logTargets = [];
    const logGroups = new Map<string, { status: BlockStatus; remark: string | null; ids: string[] }>();
    if (logTargets.length > 0) {
      const sourceBlockIds = [...new Set(logTargets.map(t => t.timeBlockId))];
      const existingLogs = await prisma.blockSessionLog.findMany({
        where: { timeBlockId: { in: sourceBlockIds }, date: { in: normalizedDates } },
        select: { id: true, timeBlockId: true, date: true },
      });
      const logKey = (timeBlockId: string, date: Date) => `${timeBlockId}|${date.getTime()}`;
      const existingLogByKey = new Map(existingLogs.map(l => [logKey(l.timeBlockId, l.date), l]));

      for (const target of logTargets) {
        const existing = existingLogByKey.get(logKey(target.timeBlockId, target.date));
        if (!existing) {
          logsToCreate.push(target);
        } else {
          const key = `${target.status}|${target.remark ?? ''}`;
          const group = logGroups.get(key) ?? { status: target.status, remark: target.remark, ids: [] };
          group.ids.push(existing.id);
          logGroups.set(key, group);
        }
      }
    }

    // Final per-date stats, computed in memory from the pre-write slot list
    // plus the statuses we're about to apply — no need to re-read after
    // writing just to count what we already know.
    const statsByDate = new Map<number, { planned: number; completed: number; skipped: number }>();
    for (const s of allSlotsInRange) {
      const key = s.date.getTime();
      const status = newStatusById.get(s.id) ?? s.status;
      const bucket = statsByDate.get(key) ?? { planned: 0, completed: 0, skipped: 0 };
      bucket.planned++;
      if (status === 'COMPLETED' || status === 'PARTIAL') bucket.completed++;
      if (status === 'SKIPPED') bucket.skipped++;
      statsByDate.set(key, bucket);
    }
    const statValues = normalizedDates.map(date => {
      const stats = statsByDate.get(date.getTime()) ?? { planned: 0, completed: 0, skipped: 0 };
      return Prisma.sql`(${date}::timestamp, ${stats.planned}, ${stats.completed}, ${stats.skipped})`;
    });

    // ── Writes only, inside a short transaction ─────────────────────────
    await prisma.$transaction(async (tx) => {
      if (newDebriefDates.length > 0) {
        await tx.dayDebrief.createMany({
          data: newDebriefDates.map(date => ({
            workspaceId,
            date,
            blocksPlanned: 0, // corrected by the bulk stats update below
            blocksCompleted: 0,
            blocksSkipped: 0,
            totalFocusedMin: 0,
            energy: input.sharedContext.energy,
            focus: input.sharedContext.focus,
            mood: input.sharedContext.mood,
            tags: input.sharedContext.tags,
            narrative: input.sharedContext.narrative,
          })),
        });
      }
      await tx.dayDebrief.updateMany({
        where: { workspaceId, date: { in: normalizedDates } },
        data: {
          energy: input.sharedContext.energy,
          focus: input.sharedContext.focus,
          mood: input.sharedContext.mood,
          tags: input.sharedContext.tags,
          narrative: input.sharedContext.narrative,
        },
      });

      for (const group of slotGroups.values()) {
        await tx.dailyScheduleSlot.updateMany({
          where: { id: { in: group.ids }, workspaceId },
          data: { status: group.status, remark: group.remark },
        });
      }

      if (logsToCreate.length > 0) {
        await tx.blockSessionLog.createMany({ data: logsToCreate, skipDuplicates: true });
      }
      for (const group of logGroups.values()) {
        await tx.blockSessionLog.updateMany({
          where: { id: { in: group.ids } },
          data: { status: group.status, remark: group.remark },
        });
      }

      // One statement for every date's stats, instead of one update per
      // date — verified against production data to update exactly the
      // rows it targets and nothing else.
      if (statValues.length > 0) {
        await tx.$executeRaw(Prisma.sql`
          UPDATE "DayDebrief" AS d
          SET "blocksPlanned" = v.planned::int,
              "blocksCompleted" = v.completed::int,
              "blocksSkipped" = v.skipped::int,
              "totalFocusedMin" = 0
          FROM (VALUES ${Prisma.join(statValues)}) AS v(date, planned, completed, skipped)
          WHERE d."workspaceId" = ${workspaceId} AND d."date" = v.date
        `);
      }
    }, { timeout: 10000 }); // safety margin — the transaction itself now only holds ~5-8 write statements

    revalidatePath('/dashboard');
    return { success: true };
  } catch (error) {
    console.error('Failed to save multi-day catch-up:', error);
    return { success: false, error: 'Failed to save catch-up' };
  }
}

// ====================================================================
// LOOKUP: EXISTING DEBRIEFS FOR A SET OF DATES
// ====================================================================

/**
 * Returns any DayDebrief rows already saved for the given 'YYYY-MM-DD'
 * dates, keyed by date string.
 *
 * Used by MultiDayCatchUpModal so reopening for a gap that already has
 * partial context (shared energy/focus/mood/narrative saved, but some
 * blocks left unresolved) prefills that context instead of asking the
 * user to retype it. Re-entering data you already gave is exactly the
 * "more inputs" friction this flow exists to avoid.
 */
export async function getDebriefsForDates(dates: string[]) {
  const { workspaceId } = await getSession();
  try {
    const normalized = dates.map(fromISTDateString);
    const debriefs = await prisma.dayDebrief.findMany({
      where: { workspaceId, date: { in: normalized } },
    });
    const byDate: Record<string, typeof debriefs[number]> = {};
    for (const d of debriefs) byDate[toISTDateString(d.date)] = d;
    return { success: true, debriefs: byDate };
  } catch (error) {
    console.error('Failed to get debriefs for dates:', error);
    return { success: false, error: 'Failed to fetch debriefs' };
  }
}
