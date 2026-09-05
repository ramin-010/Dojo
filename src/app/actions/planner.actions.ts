'use server';

import { prisma } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { getSession } from '@/lib/auth';
import { BlockStatus } from '@prisma/client';
import { completeRevision } from './revision.actions';
import {
  getISTMidnight,
  getISTDayOfWeek,
  eachISTDayInRange,
  isSameISTDay,
  addDays,
} from '@/lib/date';
// ====================================================================
// TIME BLOCKS
// ====================================================================

export async function getTimeBlocks() {
  const { userId, workspaceId } = await getSession();
  try {
    const blocks = await prisma.timeBlock.findMany({
      where: { workspaceId },
      orderBy: { startTime: 'asc' },
    });
    return blocks;
  } catch (error) {
    console.error('Failed to get time blocks:', error);
    throw new Error('Failed to fetch time blocks');
  }
}

export async function updateRoutineMode(mode: 'MASTER' | 'DAILY') {
  const { userId, workspaceId } = await getSession();
  try {
    await prisma.workspace.update({
      where: { id: workspaceId },
      data: { routineMode: mode },
    });
    revalidatePath('/dashboard');
    revalidatePath('/dashboard/planner');
  } catch (error) {
    console.error('Failed to update routine mode:', error);
    throw new Error('Failed to update routine mode');
  }
}

export async function createTimeBlock(data: {
  title: string;
  startTime: string;
  endTime: string;
  color: string;
  dayOfWeek?: number | null;
  date?: Date | null;
}) {
  const { userId, workspaceId } = await getSession();
  try {
    const block = await prisma.timeBlock.create({
      data: {
        workspaceId,
        title: data.title,
        startTime: data.startTime,
        endTime: data.endTime,
        color: data.color,
        dayOfWeek: data.dayOfWeek,
        date: data.date,
      },
    });
    revalidatePath('/dashboard/planner');
    return block;
  } catch (error) {
    console.error('Failed to create time block:', error);
    throw new Error('Failed to create time block');
  }
}

export async function deleteTimeBlock(id: string) {
  const { userId, workspaceId } = await getSession();
  try {
    await prisma.timeBlock.delete({
      where: { id, workspaceId },
    });
    revalidatePath('/dashboard/planner');
  } catch (error) {
    console.error('Failed to delete time block:', error);
    throw new Error('Failed to delete time block');
  }
}

// ====================================================================
// TASKS & REVISIONS
// ====================================================================

export async function getTasksAndRevisionsForMonth(year: number, month: number) {
  const { userId, workspaceId } = await getSession();
  try {
    // Month is 0-indexed in JS dates (0 = Jan, 11 = Dec)
    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 0, 23, 59, 59, 999);

    // 1. Fetch Tasks (Captures of type TASK with a dueDate)
    const tasks = await prisma.capture.findMany({
      where: {
        workspaceId,
        type: 'TASK',
        dueDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: { dueDate: 'asc' },
    });

    // 2. Fetch Reminders (Reminders attached to NOTE or LINK)
    const reminders = await prisma.reminder.findMany({
      where: {
        remindAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        capture: true,
      },
      orderBy: { remindAt: 'asc' },
    });

    // 3. Fetch Revisions
    const revisions = await prisma.revision.findMany({
      where: {
        OR: [
          { topic: { subject: { workspaceId } } },
          { capture: { workspaceId } },
        ],
        scheduledFor: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        topic: {
          select: { id: true, title: true, subject: { select: { id: true, color: true, name: true } } },
        },
        capture: {
          select: { id: true, title: true, content: true, subject: { select: { id: true, color: true, name: true } } },
        },
      },
      orderBy: { scheduledFor: 'asc' },
    });

    // Map Reminders into "tasks" format for the UI temporarily, or return separately
    const combinedTasks = [
      ...tasks,
      ...reminders.map(r => ({
        id: r.id, // Not the capture ID, the reminder ID? Or the capture ID?
        title: r.capture.title || r.capture.content?.substring(0, 30) || 'Reminder',
        isDone: r.isDismissed,
        dueDate: r.remindAt,
        type: 'REMINDER', // so UI can distinguish if it wants
        captureId: r.captureId,
      }))
    ];

    return { tasks: combinedTasks, revisions };
  } catch (error) {
    console.error('Failed to get tasks and revisions:', error);
    throw new Error('Failed to fetch tasks and revisions');
  }
}
export async function toggleRevision(id: string, isDone: boolean) {
  try {
    if (isDone) {
      // Route through the proper pipeline to update streaks and logs
      const revision = await completeRevision(id);
      revalidatePath('/dashboard/planner');
      revalidatePath('/dashboard');
      return revision;
    } else {
      // For now, simply revert the status if untoggled (does not cleanly undo streak)
      const revision = await prisma.revision.update({
        where: { id },
        data: {
          status: 'pending',
          completedAt: null,
        },
      });
      revalidatePath('/dashboard/planner');
      revalidatePath('/dashboard');
      return revision;
    }
  } catch (error) {
    console.error('Failed to toggle revision:', error);
    throw new Error('Failed to toggle revision');
  }
}

export async function rescheduleRevision(id: string, newDate: Date) {
  try {
    const current = await prisma.revision.findUnique({
      where: { id },
    });
    if (!current) throw new Error('Revision not found');

    const currentMidnight = getISTMidnight(new Date(current.scheduledFor));
    const targetMidnight = getISTMidnight(new Date(newDate));
    const daysDiff = Math.round((targetMidnight.getTime() - currentMidnight.getTime()) / (1000 * 60 * 60 * 24));

    await prisma.revision.update({
      where: { id },
      data: { scheduledFor: targetMidnight, status: 'pending' },
    });

    if (daysDiff !== 0) {
      const filterClause = current.topicId 
        ? { topicId: current.topicId } 
        : { captureId: current.captureId };
        
      const futureRevisions = await prisma.revision.findMany({
        where: {
          ...filterClause,
          cycleNumber: { gt: current.cycleNumber },
        },
      });

      for (const rev of futureRevisions) {
        // addDays keeps the value a clean IST day label. `setDate` would
        // read/write server-local components and corrupt the label on a
        // non-UTC host.
        await prisma.revision.update({
          where: { id: rev.id },
          data: { scheduledFor: addDays(getISTMidnight(rev.scheduledFor), daysDiff) },
        });
      }
    }

    revalidatePath('/dashboard/planner');
    revalidatePath('/dashboard');
    return true;
  } catch (error) {
    console.error('Failed to reschedule revision:', error);
    throw new Error('Failed to reschedule revision');
  }
}

// ====================================================================
// SCHEDULE SESSION TRACKING & AI LOGGING
// ====================================================================

export async function logSession(
  timeBlockId: string,
  date: Date,
  status: BlockStatus,
  remark?: string,
  minutesDone?: number
) {
  try {
    const targetMidnight = getISTMidnight(date);

    const log = await prisma.blockSessionLog.upsert({
      where: {
        timeBlockId_date: {
          timeBlockId,
          date: targetMidnight,
        },
      },
      update: {
        status,
        remark,
        minutesDone,
      },
      create: {
        timeBlockId,
        date: targetMidnight,
        status,
        remark,
        minutesDone,
      },
    });

    revalidatePath('/dashboard');
    revalidatePath('/dashboard/planner');
    return log;
  } catch (error) {
    console.error('Failed to log session:', error);
    throw new Error('Failed to log schedule session');
  }
}

export async function getUnverifiedBlocks() {
  const { userId, workspaceId } = await getSession();
  try {
    const now = new Date();

    // Dynamic lookback: start from the last debrief date, fallback to 30 days ago
    const lastDebrief = await prisma.dayDebrief.findFirst({
      where: { workspaceId },
      orderBy: { date: 'desc' },
      select: { date: true },
    });
    const fallbackDate = addDays(getISTMidnight(now), -30);
    const startRange = getISTMidnight(lastDebrief?.date || fallbackDate);

    const todayMidnight = getISTMidnight(now);

    const unverifiedSlots = await prisma.dailyScheduleSlot.findMany({
      where: { 
        workspaceId,
        date: {
          gte: startRange,
          lt: todayMidnight // strictly before today
        },
        status: 'UPCOMING'
      },
      orderBy: [{ date: 'asc' }, { sortOrder: 'asc' }]
    });

    // Auto-heal discrepancy: Check if any of these already have a terminal BlockSessionLog
    const sourceBlockIds = unverifiedSlots.map(s => s.sourceBlockId).filter(Boolean) as string[];
    const existingLogs = await prisma.blockSessionLog.findMany({
      where: {
        timeBlockId: { in: sourceBlockIds },
        date: {
          gte: startRange,
          lt: todayMidnight
        }
      }
    });

    const trulyUnverified = [];
    for (const slot of unverifiedSlots) {
      if (slot.sourceBlockId) {
        // Find a log with the same block ID and within 24 hours (to account for timezone offsets)
        const existingLog = existingLogs.find(log => 
          log.timeBlockId === slot.sourceBlockId &&
          Math.abs(log.date.getTime() - slot.date.getTime()) <= 24 * 60 * 60 * 1000
        );
        
        if (existingLog && (existingLog.status === 'COMPLETED' || existingLog.status === 'SKIPPED' || existingLog.status === 'PARTIAL')) {
          // Auto-heal the database silently
          await prisma.dailyScheduleSlot.update({
            where: { id: slot.id },
            data: { status: existingLog.status as any, remark: existingLog.remark }
          });
          continue;
        }
      }
      trulyUnverified.push(slot);
    }

    return trulyUnverified.map(slot => ({
      slot: {
        id: slot.id,
        sourceBlockId: slot.sourceBlockId,
        title: slot.title,
        startTime: slot.startTime,
        endTime: slot.endTime,
        color: slot.color,
        remark: slot.remark,
      },
      date: slot.date,
    }));
  } catch (error) {
    console.error('Failed to get unverified blocks:', error);
    return [];
  }
}

export async function shiftOrOverwriteBlock(
  targetBlockId: string, 
  targetDate: Date, 
  newStartTime: string, 
  newEndTime: string, 
  newTitle: string, 
  remark: string
) {
  const { userId, workspaceId } = await getSession();
  try {
    const targetMidnight = getISTMidnight(targetDate);

    // 1. Log original block as SKIPPED
    await prisma.blockSessionLog.upsert({
      where: {
        timeBlockId_date: {
          timeBlockId: targetBlockId,
          date: targetMidnight,
        },
      },
      update: {
        status: 'SKIPPED',
        remark,
      },
      create: {
        timeBlockId: targetBlockId,
        date: targetMidnight,
        status: 'SKIPPED',
        remark,
      },
    });

    // 2. Create one-off block for the new time
    const newBlock = await prisma.timeBlock.create({
      data: {
        workspaceId,
        title: newTitle,
        startTime: newStartTime,
        endTime: newEndTime,
        color: '#f59e0b', // Amber for shifted blocks
        date: targetMidnight, // Specific date makes it a one-off
      }
    });

    revalidatePath('/dashboard');
    revalidatePath('/dashboard/planner');
    return newBlock;
  } catch (error) {
    console.error('Failed to shift or overwrite block:', error);
    throw new Error('Failed to shift/overwrite block');
  }
}

/**
 * Marks every scheduled block in a date range as SKIPPED (the "vacation"
 * flow on the planner page).
 *
 * Two bugs used to live here and both made this silently do nothing:
 *   1. It compared `d.getDay()` (JS: 0 = Sunday) against
 *      `TimeBlock.dayOfWeek`, which uses the app convention 0 = Monday.
 *      Every DAILY-mode skip landed on the wrong weekday.
 *   2. It never looked at MASTER-mode templates, which carry
 *      `dayOfWeek: null`. MASTER is the default routine mode, so for most
 *      workspaces this function created zero logs — you'd mark a vacation,
 *      come back, and still get the full catch-up modal.
 */
export async function bulkPreSkip(startDate: Date, endDate: Date, remark: string) {
  const { userId, workspaceId } = await getSession();
  try {
    const startMidnight = getISTMidnight(startDate);
    const endMidnight = getISTMidnight(endDate);

    if (startMidnight > endMidnight) {
      throw new Error('Start date must be on or before the end date');
    }

    const [workspace, blocks] = await Promise.all([
      prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: { routineMode: true },
      }),
      prisma.timeBlock.findMany({ where: { workspaceId } }),
    ]);

    const routineMode = workspace?.routineMode || 'MASTER';

    const logsToCreate: Array<{
      timeBlockId: string;
      date: Date;
      status: BlockStatus;
      remark: string;
    }> = [];

    for (const day of eachISTDayInRange(startMidnight, endMidnight)) {
      const dayOfWeek = getISTDayOfWeek(day); // 0 = Mon .. 6 = Sun

      for (const block of blocks) {
        // A one-off block pinned to this specific date always counts,
        // regardless of routine mode.
        const isOneOffForThisDay = !!block.date && isSameISTDay(block.date, day);

        // Recurring templates: MASTER blocks (dayOfWeek === null) apply to
        // every day; DAILY blocks apply only to their weekday.
        const isRecurringForThisDay =
          !block.date &&
          (routineMode === 'MASTER'
            ? block.dayOfWeek === null
            : block.dayOfWeek === dayOfWeek);

        if (isOneOffForThisDay || isRecurringForThisDay) {
          logsToCreate.push({
            timeBlockId: block.id,
            date: day,
            status: 'SKIPPED' as BlockStatus,
            remark,
          });
        }
      }
    }

    if (logsToCreate.length > 0) {
      await prisma.blockSessionLog.createMany({
        data: logsToCreate,
        skipDuplicates: true,
      });
    }

    // Days inside the range may already have DailyScheduleSlot rows (today's
    // slots are generated on every dashboard load, and backfill fills the
    // past). BlockSessionLog alone doesn't suppress triage for those days —
    // getUnverifiedBlocks reads the slots — so settle them here too. Only
    // UPCOMING slots are touched, so an already-completed block is never
    // clobbered by a later vacation entry.
    const skippedSlots = await prisma.dailyScheduleSlot.updateMany({
      where: {
        workspaceId,
        date: { gte: startMidnight, lte: endMidnight },
        status: 'UPCOMING',
      },
      data: { status: 'SKIPPED', remark },
    });

    revalidatePath('/dashboard');
    revalidatePath('/dashboard/planner');
    return logsToCreate.length + skippedSlots.count;
  } catch (error) {
    console.error('Failed to bulk pre-skip:', error);
    throw new Error('Failed to bulk pre-skip');
  }
}
