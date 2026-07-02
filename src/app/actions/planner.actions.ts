'use server';

import { prisma } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { DEV_WORKSPACE_ID } from '@/lib/constants';

// ====================================================================
// TIME BLOCKS
// ====================================================================

export async function getTimeBlocks() {
  try {
    const blocks = await prisma.timeBlock.findMany({
      where: { workspaceId: DEV_WORKSPACE_ID },
      orderBy: { startTime: 'asc' },
    });
    return blocks;
  } catch (error) {
    console.error('Failed to get time blocks:', error);
    throw new Error('Failed to fetch time blocks');
  }
}

export async function updateRoutineMode(mode: 'MASTER' | 'DAILY') {
  try {
    await prisma.workspace.update({
      where: { id: DEV_WORKSPACE_ID },
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
  try {
    const block = await prisma.timeBlock.create({
      data: {
        workspaceId: DEV_WORKSPACE_ID,
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
  try {
    await prisma.timeBlock.delete({
      where: { id, workspaceId: DEV_WORKSPACE_ID },
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
  try {
    // Month is 0-indexed in JS dates (0 = Jan, 11 = Dec)
    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 0, 23, 59, 59, 999);

    // 1. Fetch Tasks (Captures of type TASK with a dueDate)
    const tasks = await prisma.capture.findMany({
      where: {
        workspaceId: DEV_WORKSPACE_ID,
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
          { topic: { subject: { workspaceId: DEV_WORKSPACE_ID } } },
          { capture: { workspaceId: DEV_WORKSPACE_ID } },
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
    const revision = await prisma.revision.update({
      where: { id },
      data: {
        status: isDone ? 'done' : 'pending',
        completedAt: isDone ? new Date() : null,
      },
    });
    revalidatePath('/dashboard/planner');
    revalidatePath('/dashboard');
    return revision;
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

    const currentMidnight = new Date(current.scheduledFor);
    currentMidnight.setHours(0,0,0,0);
    const targetMidnight = new Date(newDate);
    targetMidnight.setHours(0,0,0,0);
    const daysDiff = Math.round((targetMidnight.getTime() - currentMidnight.getTime()) / (1000 * 60 * 60 * 24));

    await prisma.revision.update({
      where: { id },
      data: { scheduledFor: newDate, status: 'pending' },
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
        const newRevDate = new Date(rev.scheduledFor);
        newRevDate.setDate(newRevDate.getDate() + daysDiff);
        await prisma.revision.update({
          where: { id: rev.id },
          data: { scheduledFor: newRevDate },
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
