'use server';

import { prisma } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { SlotStatus, BlockStatus } from '@prisma/client';
import { getISTMidnight } from '@/lib/utils';
import { getSession } from '@/lib/auth';

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
