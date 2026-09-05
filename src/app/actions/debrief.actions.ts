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
    await prisma.$transaction(async (tx) => {
      // 1. Create a DayDebrief for each missed date with the shared context
      for (const dateStr of input.dates) {
        const normalizedDate = fromISTDateString(dateStr);

        await tx.dayDebrief.upsert({
          where: {
            workspaceId_date: {
              workspaceId,
              date: normalizedDate,
            },
          },
          create: {
            workspaceId,
            date: normalizedDate,
            blocksPlanned: 0, // Will be corrected below
            blocksCompleted: 0,
            blocksSkipped: 0,
            totalFocusedMin: 0,
            energy: input.sharedContext.energy,
            focus: input.sharedContext.focus,
            mood: input.sharedContext.mood,
            tags: input.sharedContext.tags,
            narrative: input.sharedContext.narrative,
          },
          update: {
            energy: input.sharedContext.energy,
            focus: input.sharedContext.focus,
            mood: input.sharedContext.mood,
            tags: input.sharedContext.tags,
            narrative: input.sharedContext.narrative,
          },
        });
      }

      // 2. Update each slot and create BlockSessionLog.
      // Defensive: only explicit COMPLETED/SKIPPED decisions may mutate a
      // slot. A block the user never marked must keep its UPCOMING status —
      // writing a default here is what produced phantom "skips" for blocks
      // nobody touched.
      const explicitUpdates = input.slotUpdates.filter(
        u => u.status === 'COMPLETED' || u.status === 'SKIPPED'
      );

      for (const update of explicitUpdates) {
        // Resolve the slot within this workspace first. A slot id belonging
        // to someone else simply does not resolve, so it is skipped rather
        // than written to. This also gives us the authoritative date and
        // sourceBlockId instead of trusting the ones the client sent.
        const slot = await tx.dailyScheduleSlot.findFirst({
          where: { id: update.slotId, workspaceId },
        });
        if (!slot) continue;

        await tx.dailyScheduleSlot.update({
          where: { id: slot.id },
          data: {
            status: update.status,
            remark: update.remark || null,
          },
        });

        if (slot.sourceBlockId) {
          const blockStatus: BlockStatus = update.status === 'SKIPPED' ? 'SKIPPED' : 'COMPLETED';
          await tx.blockSessionLog.upsert({
            where: {
              timeBlockId_date: {
                timeBlockId: slot.sourceBlockId,
                date: slot.date,
              },
            },
            update: { status: blockStatus, remark: update.remark || null },
            create: {
              timeBlockId: slot.sourceBlockId,
              date: slot.date,
              status: blockStatus,
              remark: update.remark || null,
            },
          });
        }
      }

      // 3. Correct the debrief stats per date
      for (const dateStr of input.dates) {
        const normalizedDate = fromISTDateString(dateStr);
        const dateSlots = await tx.dailyScheduleSlot.findMany({
          where: { workspaceId, date: normalizedDate },
        });

        const planned = dateSlots.length;
        const completed = dateSlots.filter(s => s.status === 'COMPLETED' || s.status === 'PARTIAL').length;
        const skipped = dateSlots.filter(s => s.status === 'SKIPPED').length;

        await tx.dayDebrief.update({
          where: {
            workspaceId_date: {
              workspaceId,
              date: normalizedDate,
            },
          },
          data: {
            blocksPlanned: planned,
            blocksCompleted: completed,
            blocksSkipped: skipped,
            totalFocusedMin: 0,
          },
        });
      }
    });

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
