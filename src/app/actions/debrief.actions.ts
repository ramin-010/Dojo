'use server';

import { prisma } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { startOfDay } from 'date-fns';
import { getISTMidnight, fromISTDateString, toISTDateString } from '@/lib/date';
import { getSession } from '@/lib/auth';
import { SlotStatus, BlockStatus } from '@prisma/client';

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

    // Everything below is written as a handful of batched queries rather
    // than one query per date/block. The original version ran a full
    // upsert per date plus a findFirst+update(+upsert) per block — for a
    // week-long gap (6 dates x 6 blocks) that's 100+ sequential round trips
    // inside one interactive transaction, comfortably over Prisma's 5s
    // transaction timeout on Neon's latency. The transaction rolled back
    // silently (P2028), the action returned {success:false}, and the
    // client — which didn't check that flag — showed "Catch-up saved!"
    // and closed anyway. Nothing was ever written.
    await prisma.$transaction(async (tx) => {
      // ── 1. Shared context for every date, in three queries total ─────
      // Every date in this catch-up gets the identical energy/focus/mood/
      // narrative, so this collapses to find-existing / create-missing /
      // update-all-at-once instead of one upsert per date.
      const existingDebriefs = await tx.dayDebrief.findMany({
        where: { workspaceId, date: { in: normalizedDates } },
        select: { date: true },
      });
      const existingDebriefDates = new Set(existingDebriefs.map(d => d.date.getTime()));
      const newDebriefDates = normalizedDates.filter(d => !existingDebriefDates.has(d.getTime()));

      if (newDebriefDates.length > 0) {
        await tx.dayDebrief.createMany({
          data: newDebriefDates.map(date => ({
            workspaceId,
            date,
            blocksPlanned: 0, // corrected in step 4, once final slot statuses are known
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

      // ── 2. Resolve every slot in one query, not one per block ────────
      // A slot id belonging to someone else, or already deleted, simply
      // isn't in `slotById` and is skipped rather than written to.
      const slotIds = explicitUpdates.map(u => u.slotId);
      const slots = slotIds.length > 0
        ? await tx.dailyScheduleSlot.findMany({ where: { id: { in: slotIds }, workspaceId } })
        : [];
      const slotById = new Map(slots.map(s => [s.id, s]));

      // ── 3. Slot status writes, grouped by (status, remark) ───────────
      // In the common case every block in the batch shares the same status
      // (SKIPPED) and no remark, so this is one updateMany for the whole
      // batch; the rare per-block exception adds one group each.
      type SlotGroup = { status: 'COMPLETED' | 'SKIPPED'; remark: string | null; ids: string[] };
      const slotGroups = new Map<string, SlotGroup>();
      for (const update of explicitUpdates) {
        const slot = slotById.get(update.slotId);
        if (!slot) continue;
        const remark = update.remark || null;
        const key = `${update.status}|${remark ?? ''}`;
        const group = slotGroups.get(key) ?? { status: update.status, remark, ids: [] };
        group.ids.push(slot.id);
        slotGroups.set(key, group);
      }
      for (const group of slotGroups.values()) {
        await tx.dailyScheduleSlot.updateMany({
          where: { id: { in: group.ids }, workspaceId },
          data: { status: group.status, remark: group.remark },
        });
      }

      // ── 4. BlockSessionLog: create the (almost always) missing rows in
      // one shot, batch-update the rare pre-existing ones ──────────────
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

      if (logTargets.length > 0) {
        const sourceBlockIds = [...new Set(logTargets.map(t => t.timeBlockId))];
        const existingLogs = await tx.blockSessionLog.findMany({
          where: { timeBlockId: { in: sourceBlockIds }, date: { in: normalizedDates } },
          select: { id: true, timeBlockId: true, date: true },
        });
        const logKey = (timeBlockId: string, date: Date) => `${timeBlockId}|${date.getTime()}`;
        const existingLogByKey = new Map(existingLogs.map(l => [logKey(l.timeBlockId, l.date), l]));

        const toCreate: typeof logTargets = [];
        const logGroups = new Map<string, { status: BlockStatus; remark: string | null; ids: string[] }>();

        for (const target of logTargets) {
          const existing = existingLogByKey.get(logKey(target.timeBlockId, target.date));
          if (!existing) {
            toCreate.push(target);
          } else {
            const key = `${target.status}|${target.remark ?? ''}`;
            const group = logGroups.get(key) ?? { status: target.status, remark: target.remark, ids: [] };
            group.ids.push(existing.id);
            logGroups.set(key, group);
          }
        }

        if (toCreate.length > 0) {
          await tx.blockSessionLog.createMany({ data: toCreate, skipDuplicates: true });
        }
        for (const group of logGroups.values()) {
          await tx.blockSessionLog.updateMany({
            where: { id: { in: group.ids } },
            data: { status: group.status, remark: group.remark },
          });
        }
      }

      // ── 5. Recompute each date's stats from one query ─────────────────
      // Interactive transactions read their own prior writes, so this
      // already reflects everything written in steps 3-4.
      const allDaySlots = await tx.dailyScheduleSlot.findMany({
        where: { workspaceId, date: { in: normalizedDates } },
        select: { date: true, status: true },
      });
      const statsByDate = new Map<number, { planned: number; completed: number; skipped: number }>();
      for (const s of allDaySlots) {
        const key = s.date.getTime();
        const bucket = statsByDate.get(key) ?? { planned: 0, completed: 0, skipped: 0 };
        bucket.planned++;
        if (s.status === 'COMPLETED' || s.status === 'PARTIAL') bucket.completed++;
        if (s.status === 'SKIPPED') bucket.skipped++;
        statsByDate.set(key, bucket);
      }
      for (const date of normalizedDates) {
        const stats = statsByDate.get(date.getTime()) ?? { planned: 0, completed: 0, skipped: 0 };
        await tx.dayDebrief.update({
          where: { workspaceId_date: { workspaceId, date } },
          data: {
            blocksPlanned: stats.planned,
            blocksCompleted: stats.completed,
            blocksSkipped: stats.skipped,
            totalFocusedMin: 0,
          },
        });
      }
    }, { timeout: 15000 }); // generous safety margin — see note above on why the default 5s isn't enough headroom for a long gap

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
