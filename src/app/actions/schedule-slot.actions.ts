'use server';

import { prisma } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { DEV_WORKSPACE_ID } from '@/lib/constants';
import { SlotStatus, BlockStatus } from '@prisma/client';

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
  const todayMidnight = new Date();
  todayMidnight.setHours(0, 0, 0, 0);

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

// ====================================================================
// MARK SLOT ACTIVE
// ====================================================================

/**
 * Called when the clock enters a slot's time range.
 * Sets status = ACTIVE and records actualStartTime.
 */
export async function markSlotActive(slotId: string) {
  try {
    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    await prisma.dailyScheduleSlot.update({
      where: { id: slotId },
      data: {
        status: 'ACTIVE',
        actualStartTime: currentTime,
      },
    });

    revalidatePath('/dashboard');
  } catch (error) {
    console.error('Failed to mark slot active:', error);
    throw new Error('Failed to mark slot active');
  }
}

// ====================================================================
// COMPLETE SLOT
// ====================================================================

/**
 * Smart completion:
 * - COMPLETED if no minutesDone (finished within schedule or flow state)
 * - PARTIAL if minutesDone is provided (ended early)
 * Also writes a BlockSessionLog entry for history.
 * Also handles auto-consuming fully eaten subsequent slots.
 */
export async function completeSlot(
  slotId: string,
  remark?: string,
  minutesDone?: number
) {
  try {
    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    const slot = await prisma.dailyScheduleSlot.findUnique({
      where: { id: slotId },
    });
    if (!slot) throw new Error('Slot not found');

    const status: SlotStatus = minutesDone !== undefined ? 'PARTIAL' : 'COMPLETED';

    // If flow state (extending past schedule), update endTime to persist the stretch
    const [eh, em] = slot.endTime.split(':').map(Number);
    const scheduledEndMin = eh * 60 + em;
    const currentMin = now.getHours() * 60 + now.getMinutes();
    const isFlowState = currentMin > scheduledEndMin;

    await prisma.dailyScheduleSlot.update({
      where: { id: slotId },
      data: {
        status,
        actualEndTime: currentTime,
        remark: remark || (isFlowState ? `Flow state — extended ${currentMin - scheduledEndMin} min past schedule` : undefined),
        minutesDone,
        // Persist the stretch so it survives page refresh
        ...(isFlowState && status === 'COMPLETED' ? { endTime: currentTime } : {}),
      },
    });

    // Fire-and-forget: write BlockSessionLog for AI history
    if (slot.sourceBlockId) {
      await prisma.blockSessionLog.upsert({
        where: {
          timeBlockId_date: {
            timeBlockId: slot.sourceBlockId,
            date: slot.date,
          },
        },
        update: {
          status: status === 'PARTIAL' ? 'PARTIAL' : 'COMPLETED',
          remark: remark || undefined,
          minutesDone,
        },
        create: {
          timeBlockId: slot.sourceBlockId,
          date: slot.date,
          status: status === 'PARTIAL' ? 'PARTIAL' : 'COMPLETED',
          remark: remark || undefined,
          minutesDone,
        },
      });
    }

    // Auto-consume fully eaten subsequent slots
    if (isFlowState) {
      await autoConsumeSlots(slot.workspaceId, slot.date, currentTime, slot.title);
    }

    revalidatePath('/dashboard');
    revalidatePath('/dashboard/planner');
  } catch (error) {
    console.error('Failed to complete slot:', error);
    throw new Error('Failed to complete slot');
  }
}

// ====================================================================
// SKIP SLOT
// ====================================================================

export async function skipSlot(slotId: string, remark: string) {
  try {
    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    const slot = await prisma.dailyScheduleSlot.findUnique({
      where: { id: slotId },
    });
    if (!slot) throw new Error('Slot not found');

    await prisma.dailyScheduleSlot.update({
      where: { id: slotId },
      data: {
        status: 'SKIPPED',
        remark,
        actualEndTime: currentTime,
      },
    });

    // Fire-and-forget: write BlockSessionLog for AI history
    if (slot.sourceBlockId) {
      await prisma.blockSessionLog.upsert({
        where: {
          timeBlockId_date: {
            timeBlockId: slot.sourceBlockId,
            date: slot.date,
          },
        },
        update: { status: 'SKIPPED', remark },
        create: {
          timeBlockId: slot.sourceBlockId,
          date: slot.date,
          status: 'SKIPPED',
          remark,
        },
      });
    }

    revalidatePath('/dashboard');
    revalidatePath('/dashboard/planner');
  } catch (error) {
    console.error('Failed to skip slot:', error);
    throw new Error('Failed to skip slot');
  }
}

// ====================================================================
// START EARLY
// ====================================================================

/**
 * Starts a slot early.
 * Shifts its startTime back to currentTime, and its endTime backward by the same amount.
 * Ends any currently ACTIVE slot as PARTIAL.
 */
export async function startEarly(slotId: string, remark?: string) {
  try {
    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    const todayMidnight = new Date();
    todayMidnight.setHours(0, 0, 0, 0);

    const slot = await prisma.dailyScheduleSlot.findUnique({
      where: { id: slotId },
    });
    if (!slot) throw new Error('Slot not found');

    // Find if there is currently an ACTIVE slot, and end it
    const activeSlot = await prisma.dailyScheduleSlot.findFirst({
      where: {
        workspaceId: slot.workspaceId,
        status: 'ACTIVE',
      },
    });

    if (activeSlot) {
      const [sh, sm] = activeSlot.startTime.split(':').map(Number);
      const startMin = sh * 60 + sm;
      let currentMin = now.getHours() * 60 + now.getMinutes();
      if (currentMin < startMin) currentMin += 24 * 60;
      const minutesDone = Math.max(0, currentMin - startMin);

      await completeSlot(activeSlot.id, 'Ended early due to jumping to next block', minutesDone);
      
      // OPTION 1: Shrink the previous block to prevent overlap in the database
      await prisma.dailyScheduleSlot.update({
        where: { id: activeSlot.id },
        data: { endTime: currentTime }
      });
    }

    // Calculate how much we are shifting this slot backward
    const [sth, stm] = slot.startTime.split(':').map(Number);
    let originalStartMin = sth * 60 + stm;
    let newStartMin = now.getHours() * 60 + now.getMinutes();
    
    // Handle midnight crossover logic
    if (newStartMin > originalStartMin && originalStartMin < 4 * 60) {
       // It means we are jumping early into a block that crosses past midnight tomorrow.
       // Actually, assume newStartMin is always <= originalStartMin within the day's span.
    }
    
    const shiftDiff = originalStartMin - newStartMin;

    const [enh, enm] = slot.endTime.split(':').map(Number);
    let originalEndMin = enh * 60 + enm;
    let newEndMin = originalEndMin - shiftDiff;

    // Format new times
    const formatTime = (min: number) => {
      let m = min;
      if (m < 0) m += 24 * 60;
      if (m >= 24 * 60) m -= 24 * 60;
      const hh = Math.floor(m / 60).toString().padStart(2, '0');
      const mm = (m % 60).toString().padStart(2, '0');
      return `${hh}:${mm}`;
    };

    const newStartTime = formatTime(newStartMin);
    const newEndTime = formatTime(newEndMin);

    await prisma.dailyScheduleSlot.update({
      where: { id: slotId },
      data: {
        startTime: newStartTime,
        endTime: newEndTime,
        status: 'ACTIVE',
        actualStartTime: currentTime,
        remark: remark || 'Started early',
      },
    });

    revalidatePath('/dashboard');
  } catch (error) {
    console.error('Failed to start early:', error);
    throw new Error('Failed to start early');
  }
}

// ====================================================================
// AUTO-CONSUME SLOTS (called internally by completeSlot)
// ====================================================================

/**
 * When a flow state extends past schedule, check if any subsequent UPCOMING
 * slots have been fully consumed (their endTime <= the actualEndTime of
 * the extended block). Auto-skip them.
 */
async function autoConsumeSlots(
  workspaceId: string,
  date: Date,
  actualEndTime: string,
  consumedByTitle: string
) {
  const [aeh, aem] = actualEndTime.split(':').map(Number);
  const actualEndMin = aeh * 60 + aem;

  const upcomingSlots = await prisma.dailyScheduleSlot.findMany({
    where: {
      workspaceId,
      date,
      status: 'UPCOMING',
    },
    orderBy: { sortOrder: 'asc' },
  });

  for (const slot of upcomingSlots) {
    const [seh, sem] = slot.endTime.split(':').map(Number);
    let slotEndMin = seh * 60 + sem;
    // Handle midnight crossover
    const [ssh, ssm] = slot.startTime.split(':').map(Number);
    if (slotEndMin <= ssh * 60 + ssm) slotEndMin += 24 * 60;

    if (actualEndMin >= slotEndMin) {
      // Fully consumed
      await prisma.dailyScheduleSlot.update({
        where: { id: slot.id },
        data: {
          status: 'SKIPPED',
          remark: `Consumed by ${consumedByTitle} flow state`,
          actualEndTime,
        },
      });

      // Also write log
      if (slot.sourceBlockId) {
        await prisma.blockSessionLog.upsert({
          where: {
            timeBlockId_date: {
              timeBlockId: slot.sourceBlockId,
              date,
            },
          },
          update: {
            status: 'SKIPPED',
            remark: `Consumed by ${consumedByTitle} flow state`,
          },
          create: {
            timeBlockId: slot.sourceBlockId,
            date,
            status: 'SKIPPED',
            remark: `Consumed by ${consumedByTitle} flow state`,
          },
        });
      }
    }
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
};

export async function updateDaySchedule(workspaceId: string, updates: DayManagerSlotUpdate[]) {
  try {
    const todayMidnight = new Date();
    todayMidnight.setHours(0, 0, 0, 0);

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
            },
          });
        } else {
          await tx.dailyScheduleSlot.update({
            where: { id: update.id },
            data: {
              title: update.title,
              color: update.color,
              startTime: update.startTime,
              endTime: update.endTime,
              status: update.status,
              sortOrder: update.sortOrder,
            },
          });
        }
      }
    });

    revalidatePath('/dashboard');
  } catch (error) {
    console.error('Failed to update day schedule:', error);
    throw new Error('Failed to update day schedule');
  }
}
