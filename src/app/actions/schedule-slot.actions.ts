'use server';

import { prisma } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { SlotStatus, BlockStatus } from '@prisma/client';
import { getISTMidnight } from '@/lib/utils';
import { getSession } from '@/lib/auth';

// ====================================================================
// BACKFILL MISSED DAYS
// ====================================================================

/**
 * Detects days where the user didn't open the app and retroactively
 * creates DailyScheduleSlot records for each missed day.
 * Returns info about the gap so the UI can decide which triage modal to show.
 */
export async function backfillMissedDays(
  workspaceId: string,
  routineMode: 'MASTER' | 'DAILY'
): Promise<{ backfilledDays: number; startDate: Date | null; endDate: Date | null }> {
  const todayMidnight = getISTMidnight();

  // Find the most recent date that already has slots
  const lastSlotRecord = await prisma.dailyScheduleSlot.findFirst({
    where: { workspaceId },
    orderBy: { date: 'desc' },
    select: { date: true },
  });

  // If no slots exist at all, use the earliest TimeBlock creation as starting point
  let startFrom: Date;
  if (!lastSlotRecord) {
    const earliestBlock = await prisma.timeBlock.findFirst({
      where: { workspaceId },
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true },
    });
    if (!earliestBlock) {
      return { backfilledDays: 0, startDate: null, endDate: null };
    }
    startFrom = getISTMidnight(earliestBlock.createdAt);
  } else {
    startFrom = lastSlotRecord.date;
  }

  // Calculate the day after the last slot date
  const dayAfterLast = new Date(startFrom);
  dayAfterLast.setDate(dayAfterLast.getDate() + 1);
  const fillStart = getISTMidnight(dayAfterLast);

  // We only backfill up to yesterday (today is handled by ensureTodaySlots)
  const yesterdayDate = new Date(todayMidnight);
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const fillEnd = getISTMidnight(yesterdayDate);

  // Nothing to backfill
  if (fillStart > fillEnd) {
    return { backfilledDays: 0, startDate: null, endDate: null };
  }

  // Cap at 30 days to prevent unbounded backfill
  const maxBackfillDate = new Date(todayMidnight);
  maxBackfillDate.setDate(maxBackfillDate.getDate() - 30);
  const cappedStart = fillStart < maxBackfillDate ? maxBackfillDate : fillStart;

  // Fetch all templates once
  const allTemplates = await prisma.timeBlock.findMany({
    where: { workspaceId },
    orderBy: { startTime: 'asc' },
  });

  if (allTemplates.length === 0) {
    return { backfilledDays: 0, startDate: null, endDate: null };
  }

  // Fetch all pre-existing BlockSessionLogs in the range (from bulkPreSkip / vacation)
  const existingLogs = await prisma.blockSessionLog.findMany({
    where: {
      timeBlockId: { in: allTemplates.map(t => t.id) },
      date: { gte: cappedStart, lte: fillEnd },
    },
  });
  const logsByDateAndBlock = new Map<string, typeof existingLogs[0]>();
  for (const log of existingLogs) {
    logsByDateAndBlock.set(`${log.date.toISOString()}_${log.timeBlockId}`, log);
  }

  const allSlotsToCreate: Array<{
    workspaceId: string;
    sourceBlockId: string;
    date: Date;
    title: string;
    color: string;
    startTime: string;
    endTime: string;
    status: SlotStatus;
    remark: string | null;
    minutesDone: number | null;
    sortOrder: number;
  }> = [];

  let backfilledDays = 0;
  let actualStart: Date | null = null;
  let actualEnd: Date | null = null;

  for (let d = new Date(cappedStart); d <= fillEnd; d.setDate(d.getDate() + 1)) {
    const dayMidnight = getISTMidnight(d);
    const jsDay = d.getDay();
    const mappedDay = jsDay === 0 ? 6 : jsDay - 1;

    // Pick correct templates based on routine mode
    const dayTemplates = routineMode === 'MASTER'
      ? allTemplates.filter(t => t.dayOfWeek === null)
      : allTemplates.filter(t => t.dayOfWeek === mappedDay);

    if (dayTemplates.length === 0) continue;

    backfilledDays++;
    if (!actualStart) actualStart = new Date(dayMidnight);
    actualEnd = new Date(dayMidnight);

    dayTemplates.forEach((block, index) => {
      const existingLog = logsByDateAndBlock.get(`${dayMidnight.toISOString()}_${block.id}`);
      let initialStatus: SlotStatus = 'UPCOMING';
      let initialRemark: string | null = null;
      let initialMinutesDone: number | null = null;

      if (existingLog) {
        if (existingLog.status === 'SKIPPED') initialStatus = 'SKIPPED';
        else if (existingLog.status === 'COMPLETED') initialStatus = 'COMPLETED';
        else if (existingLog.status === 'PARTIAL') initialStatus = 'PARTIAL';
        initialRemark = existingLog.remark;
        initialMinutesDone = existingLog.minutesDone;
      }

      allSlotsToCreate.push({
        workspaceId,
        sourceBlockId: block.id,
        date: dayMidnight,
        title: block.title,
        color: block.color,
        startTime: block.startTime,
        endTime: block.endTime,
        status: initialStatus,
        remark: initialRemark,
        minutesDone: initialMinutesDone,
        sortOrder: index,
      });
    });
  }

  if (allSlotsToCreate.length > 0) {
    await prisma.dailyScheduleSlot.createMany({
      data: allSlotsToCreate,
      skipDuplicates: true,
    });
  }

  return { backfilledDays, startDate: actualStart, endDate: actualEnd };
}

// ====================================================================
// ENSURE TODAY'S SLOTS EXIST
// ====================================================================

/**
 * Auto-generates DailyScheduleSlot rows for today if they don't exist.
 * Returns all slots for today, ordered by sortOrder.
 */
export async function ensureTodaySlots(
  workspaceId: string,
  routineMode: 'MASTER' | 'DAILY'
) {
  const todayMidnight = getISTMidnight();

  // Check if slots already exist for today
  const existingSlots = await prisma.dailyScheduleSlot.findMany({
    where: { workspaceId, date: todayMidnight },
    orderBy: { sortOrder: 'asc' },
  });

  if (existingSlots.length > 0) {
    return existingSlots;
  }

  // No slots for today — generate from TimeBlock templates
  const jsDay = new Date().getDay();
  const mappedDay = jsDay === 0 ? 6 : jsDay - 1; // JS: 0=Sun, Our: 0=Mon...6=Sun

  const templates = await prisma.timeBlock.findMany({
    where: {
      workspaceId,
      ...(routineMode === 'MASTER'
        ? { dayOfWeek: null }
        : { dayOfWeek: mappedDay }),
    },
    orderBy: { startTime: 'asc' },
  });

  if (templates.length === 0) {
    return [];
  }

  // Fetch any pre-existing logs for today (e.g., from vacation pre-skip or Shift/Replace)
  const existingLogs = await prisma.blockSessionLog.findMany({
    where: {
      timeBlockId: { in: templates.map(t => t.id) },
      date: todayMidnight,
    },
  });

  const logMap = new Map(existingLogs.map(l => [l.timeBlockId, l]));

  // Create slots from templates, inheriting pre-skipped status if available
  const slotsData = templates.map((block, index) => {
    const existingLog = logMap.get(block.id);
    let initialStatus: SlotStatus = 'UPCOMING';
    let initialRemark: string | null = null;
    let initialMinutesDone: number | null = null;

    if (existingLog) {
      if (existingLog.status === 'SKIPPED') initialStatus = 'SKIPPED';
      else if (existingLog.status === 'COMPLETED') initialStatus = 'COMPLETED';
      else if (existingLog.status === 'PARTIAL') initialStatus = 'PARTIAL';
      
      initialRemark = existingLog.remark;
      initialMinutesDone = existingLog.minutesDone;
    }

    return {
      workspaceId,
      sourceBlockId: block.id,
      date: todayMidnight,
      title: block.title,
      color: block.color,
      startTime: block.startTime,
      endTime: block.endTime,
      status: initialStatus,
      remark: initialRemark,
      minutesDone: initialMinutesDone,
      sortOrder: index,
    };
  });

  await prisma.dailyScheduleSlot.createMany({
    data: slotsData,
    skipDuplicates: true,
  });

  // Return the freshly created slots
  return prisma.dailyScheduleSlot.findMany({
    where: { workspaceId, date: todayMidnight },
    orderBy: { sortOrder: 'asc' },
  });
}

export async function triageSlot(slotId: string, status: 'COMPLETED' | 'SKIPPED', remark: string) {
  try {
    const slot = await prisma.dailyScheduleSlot.findUnique({
      where: { id: slotId },
    });
    if (!slot) throw new Error('Slot not found');

    await prisma.dailyScheduleSlot.update({
      where: { id: slotId },
      data: {
        status,
        remark,
      },
    });

    if (slot.sourceBlockId) {
      await prisma.blockSessionLog.upsert({
        where: {
          timeBlockId_date: {
            timeBlockId: slot.sourceBlockId,
            date: slot.date,
          },
        },
        update: { status, remark },
        create: {
          timeBlockId: slot.sourceBlockId,
          date: slot.date,
          status,
          remark,
        },
      });
    }

    revalidatePath('/dashboard');
  } catch (error) {
    console.error('Failed to triage slot:', error);
    throw new Error('Failed to triage slot');
  }
}

// ====================================================================
// UPDATE DAY SCHEDULE (Day Manager)
// ====================================================================

export type DayManagerSlotUpdate = {
  id: string; // If 'new-...', it's a new slot
  title: string;
  color: string;
  startTime: string;
  endTime: string;
  status: SlotStatus;
  sortOrder: number;
  remark?: string | null;
};

export async function updateDaySchedule(updates: DayManagerSlotUpdate[]) {
  try {
    const { workspaceId } = await getSession();
    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    const todayMidnight = getISTMidnight();

    // Get existing slots for today to map them
    const existingSlots = await prisma.dailyScheduleSlot.findMany({
      where: { workspaceId, date: todayMidnight },
    });
    
    // We will do this in a transaction:
    // 1. Delete existing slots that are not in the updates (meaning user deleted them)
    // 2. Upsert the slots in the updates
    
    const updateIds = updates.filter(u => !u.id.startsWith('new-')).map(u => u.id);
    const slotsToDelete = existingSlots.filter(s => !updateIds.includes(s.id));

    await prisma.$transaction(async (tx) => {
      // Delete removed slots
      if (slotsToDelete.length > 0) {
        await tx.dailyScheduleSlot.deleteMany({
          where: { id: { in: slotsToDelete.map(s => s.id) } },
        });
      }

      // Upsert updates
      for (const update of updates) {
        if (update.id.startsWith('new-')) {
          await tx.dailyScheduleSlot.create({
            data: {
              workspaceId,
              date: todayMidnight,
              title: update.title,
              color: update.color,
              startTime: update.startTime,
              endTime: update.endTime,
              status: 'UPCOMING',
              sortOrder: update.sortOrder,
              remark: update.remark,
            },
          });
        } else {
          const updatedSlot = await tx.dailyScheduleSlot.update({
            where: { id: update.id },
            data: {
              title: update.title,
              color: update.color,
              startTime: update.startTime,
              endTime: update.endTime,
              status: update.status,
              sortOrder: update.sortOrder,
              remark: update.remark,
            },
          });

          // If a slot was manually marked COMPLETED/SKIPPED in the manager, sync the block session log
          if (updatedSlot.sourceBlockId && (update.status === 'COMPLETED' || update.status === 'SKIPPED' || update.status === 'PARTIAL')) {
            const blockStatus = update.status === 'SKIPPED' ? 'SKIPPED' : (update.status === 'PARTIAL' ? 'PARTIAL' : 'COMPLETED');
            await tx.blockSessionLog.upsert({
              where: {
                timeBlockId_date: {
                  timeBlockId: updatedSlot.sourceBlockId,
                  date: todayMidnight,
                }
              },
              update: {
                status: blockStatus,
                remark: update.remark,
              },
              create: {
                timeBlockId: updatedSlot.sourceBlockId,
                date: todayMidnight,
                status: blockStatus,
                remark: update.remark,
              }
            });
          }
        }
      }
    });

    revalidatePath('/dashboard');
  } catch (error) {
    console.error('Failed to update day schedule:', error);
    throw new Error('Failed to update day schedule');
  }
}
