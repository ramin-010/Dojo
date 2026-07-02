'use server';

import { prisma } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { DEV_USER_ID, DEV_WORKSPACE_ID } from '@/lib/constants';
import { BlockOutcome } from '@prisma/client';

// ====================================================================
// HELPERS
// ====================================================================

/** Parse "HH:MM" into total minutes since midnight */
function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

/** Calculate duration in minutes between two "HH:MM" strings */
function blockDuration(start: string, end: string): number {
  return timeToMinutes(end) - timeToMinutes(start);
}

/** Get today's schedule blocks based on routine mode */
async function getTodayBlocks() {
  const workspace = await prisma.workspace.findUnique({
    where: { id: DEV_WORKSPACE_ID },
    select: { routineMode: true },
  });

  const allBlocks = await prisma.timeBlock.findMany({
    where: { workspaceId: DEV_WORKSPACE_ID },
    orderBy: { startTime: 'asc' },
  });

  // JS getDay(): 0=Sun, our dayOfWeek: 0=Mon...6=Sun
  const jsDay = new Date().getDay();
  const mappedDay = jsDay === 0 ? 6 : jsDay - 1;

  return workspace?.routineMode === 'MASTER'
    ? allBlocks.filter(b => b.dayOfWeek === null)
    : allBlocks.filter(b => b.dayOfWeek === mappedDay);
}

/** Get midnight of a given date */
function getMidnight(d: Date): Date {
  const m = new Date(d);
  m.setHours(0, 0, 0, 0);
  return m;
}

// ====================================================================
// GENERATE UNRESOLVED LOGS
// Scans past blocks (up to 7 days) that have no log entry and creates
// UNRESOLVED entries for them. Called on dashboard load.
// ====================================================================

export async function generateUnresolvedLogs() {
  const now = new Date();
  const today = getMidnight(now);
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  // Look back up to 7 days
  const lookbackStart = new Date(today);
  lookbackStart.setDate(lookbackStart.getDate() - 7);

  const workspace = await prisma.workspace.findUnique({
    where: { id: DEV_WORKSPACE_ID },
    select: { routineMode: true },
  });

  const allBlocks = await prisma.timeBlock.findMany({
    where: { workspaceId: DEV_WORKSPACE_ID },
    orderBy: { startTime: 'asc' },
  });

  // Fetch all existing logs in the lookback window
  const existingLogs = await prisma.scheduleSessionLog.findMany({
    where: {
      userId: DEV_USER_ID,
      date: { gte: lookbackStart, lte: today },
    },
    select: { timeBlockId: true, date: true },
  });

  // Build a Set of "blockId|dateISO" for quick lookup
  const loggedSet = new Set(
    existingLogs.map(l => `${l.timeBlockId}|${getMidnight(l.date).toISOString()}`)
  );

  const logsToCreate: any[] = [];

  // Iterate each day in the lookback window
  for (let d = new Date(lookbackStart); d <= today; d.setDate(d.getDate() + 1)) {
    const dayMidnight = getMidnight(d);
    const jsDay = d.getDay();
    const mappedDay = jsDay === 0 ? 6 : jsDay - 1;

    const dayBlocks = workspace?.routineMode === 'MASTER'
      ? allBlocks.filter(b => b.dayOfWeek === null)
      : allBlocks.filter(b => b.dayOfWeek === mappedDay);

    for (const block of dayBlocks) {
      const key = `${block.id}|${dayMidnight.toISOString()}`;
      if (loggedSet.has(key)) continue; // Already has a log

      const blockEndMinutes = timeToMinutes(block.endTime);

      // For today: only mark blocks whose end time has passed
      const isToday = dayMidnight.getTime() === today.getTime();
      if (isToday && blockEndMinutes > currentMinutes) continue; // Block hasn't ended yet

      logsToCreate.push({
        userId: DEV_USER_ID,
        workspaceId: DEV_WORKSPACE_ID,
        timeBlockId: block.id,
        blockTitle: block.title,
        blockColor: block.color,
        date: dayMidnight,
        scheduledStart: block.startTime,
        scheduledEnd: block.endTime,
        outcome: 'UNRESOLVED' as BlockOutcome,
        minutesLogged: 0,
        isTriaged: false,
      });
    }
  }

  if (logsToCreate.length > 0) {
    await prisma.scheduleSessionLog.createMany({ data: logsToCreate });
  }

  return logsToCreate.length;
}

// ====================================================================
// FETCH UNRESOLVED BLOCKS
// ====================================================================

export async function getUnresolvedBlocks() {
  return prisma.scheduleSessionLog.findMany({
    where: {
      userId: DEV_USER_ID,
      outcome: 'UNRESOLVED',
      isTriaged: false,
    },
    orderBy: [{ date: 'asc' }, { scheduledStart: 'asc' }],
  });
}

// ====================================================================
// MARK BLOCK COMPLETED
// ====================================================================

export async function markBlockCompleted(timeBlockId: string, date?: Date) {
  const targetDate = getMidnight(date || new Date());

  const block = await prisma.timeBlock.findUnique({ where: { id: timeBlockId } });
  if (!block) throw new Error('Block not found');

  const duration = blockDuration(block.startTime, block.endTime);

  // Upsert: if an UNRESOLVED log already exists, update it. Otherwise create.
  const existing = await prisma.scheduleSessionLog.findFirst({
    where: { timeBlockId, date: targetDate, userId: DEV_USER_ID },
  });

  if (existing) {
    await prisma.scheduleSessionLog.update({
      where: { id: existing.id },
      data: {
        outcome: 'COMPLETED',
        minutesLogged: duration,
        actualEndAt: new Date(),
        isTriaged: true,
        resolvedAt: new Date(),
      },
    });
  } else {
    await prisma.scheduleSessionLog.create({
      data: {
        userId: DEV_USER_ID,
        workspaceId: DEV_WORKSPACE_ID,
        timeBlockId,
        blockTitle: block.title,
        blockColor: block.color,
        date: targetDate,
        scheduledStart: block.startTime,
        scheduledEnd: block.endTime,
        outcome: 'COMPLETED',
        minutesLogged: duration,
        actualEndAt: new Date(),
        isTriaged: true,
      },
    });
  }

  revalidatePath('/dashboard');
}

// ====================================================================
// MARK BLOCK COMPLETED EARLY
// ====================================================================

export async function markBlockCompletedEarly(timeBlockId: string, date?: Date) {
  const targetDate = getMidnight(date || new Date());
  const now = new Date();

  const block = await prisma.timeBlock.findUnique({ where: { id: timeBlockId } });
  if (!block) throw new Error('Block not found');

  // Calculate actual minutes worked (from block start to now)
  const startMinutes = timeToMinutes(block.startTime);
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const minutesWorked = Math.max(0, currentMinutes - startMinutes);

  const existing = await prisma.scheduleSessionLog.findFirst({
    where: { timeBlockId, date: targetDate, userId: DEV_USER_ID },
  });

  const data = {
    outcome: 'COMPLETED_EARLY' as BlockOutcome,
    minutesLogged: minutesWorked,
    actualEndAt: now,
    isTriaged: true,
    resolvedAt: now,
  };

  if (existing) {
    await prisma.scheduleSessionLog.update({ where: { id: existing.id }, data });
  } else {
    await prisma.scheduleSessionLog.create({
      data: {
        userId: DEV_USER_ID,
        workspaceId: DEV_WORKSPACE_ID,
        timeBlockId,
        blockTitle: block.title,
        blockColor: block.color,
        date: targetDate,
        scheduledStart: block.startTime,
        scheduledEnd: block.endTime,
        ...data,
      },
    });
  }

  revalidatePath('/dashboard');
}

// ====================================================================
// SKIP BLOCK
// ====================================================================

export async function skipBlock(
  timeBlockId: string,
  remark: string,
  remarkCategory?: string,
  date?: Date
) {
  const targetDate = getMidnight(date || new Date());

  const block = await prisma.timeBlock.findUnique({ where: { id: timeBlockId } });
  if (!block) throw new Error('Block not found');

  const existing = await prisma.scheduleSessionLog.findFirst({
    where: { timeBlockId, date: targetDate, userId: DEV_USER_ID },
  });

  const data = {
    outcome: 'SKIPPED' as BlockOutcome,
    remark,
    remarkCategory: remarkCategory || 'OTHER',
    minutesLogged: 0,
    isTriaged: true,
    resolvedAt: new Date(),
  };

  if (existing) {
    await prisma.scheduleSessionLog.update({ where: { id: existing.id }, data });
  } else {
    await prisma.scheduleSessionLog.create({
      data: {
        userId: DEV_USER_ID,
        workspaceId: DEV_WORKSPACE_ID,
        timeBlockId,
        blockTitle: block.title,
        blockColor: block.color,
        date: targetDate,
        scheduledStart: block.startTime,
        scheduledEnd: block.endTime,
        ...data,
      },
    });
  }

  revalidatePath('/dashboard');
}

// ====================================================================
// PRE-SKIP BLOCK (proactively skip a future block today)
// ====================================================================

export async function preSkipBlock(
  timeBlockId: string,
  remark: string,
  remarkCategory?: string
) {
  const targetDate = getMidnight(new Date());

  const block = await prisma.timeBlock.findUnique({ where: { id: timeBlockId } });
  if (!block) throw new Error('Block not found');

  await prisma.scheduleSessionLog.create({
    data: {
      userId: DEV_USER_ID,
      workspaceId: DEV_WORKSPACE_ID,
      timeBlockId,
      blockTitle: block.title,
      blockColor: block.color,
      date: targetDate,
      scheduledStart: block.startTime,
      scheduledEnd: block.endTime,
      outcome: 'PRE_SKIPPED',
      remark,
      remarkCategory: remarkCategory || 'OTHER',
      minutesLogged: 0,
      isTriaged: true,
    },
  });

  revalidatePath('/dashboard');
}

// ====================================================================
// INTERRUPT BLOCK (mid-block abandonment)
// ====================================================================

export async function interruptBlock(
  timeBlockId: string,
  remark: string,
  remarkCategory?: string,
  date?: Date
) {
  const targetDate = getMidnight(date || new Date());
  const now = new Date();

  const block = await prisma.timeBlock.findUnique({ where: { id: timeBlockId } });
  if (!block) throw new Error('Block not found');

  const startMinutes = timeToMinutes(block.startTime);
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const minutesWorked = Math.max(0, currentMinutes - startMinutes);

  const existing = await prisma.scheduleSessionLog.findFirst({
    where: { timeBlockId, date: targetDate, userId: DEV_USER_ID },
  });

  const data = {
    outcome: 'INTERRUPTED' as BlockOutcome,
    remark,
    remarkCategory: remarkCategory || 'OTHER',
    minutesLogged: minutesWorked,
    actualEndAt: now,
    isTriaged: true,
    resolvedAt: now,
  };

  if (existing) {
    await prisma.scheduleSessionLog.update({ where: { id: existing.id }, data });
  } else {
    await prisma.scheduleSessionLog.create({
      data: {
        userId: DEV_USER_ID,
        workspaceId: DEV_WORKSPACE_ID,
        timeBlockId,
        blockTitle: block.title,
        blockColor: block.color,
        date: targetDate,
        scheduledStart: block.startTime,
        scheduledEnd: block.endTime,
        ...data,
      },
    });
  }

  revalidatePath('/dashboard');
}

// ====================================================================
// OVERWRITE BLOCK (replace one block with another)
// ====================================================================

export async function overwriteBlock(
  victimBlockId: string,
  replacementBlockId: string,
  remark: string,
  remarkCategory?: string
) {
  const targetDate = getMidnight(new Date());

  const victimBlock = await prisma.timeBlock.findUnique({ where: { id: victimBlockId } });
  const replacementBlock = await prisma.timeBlock.findUnique({ where: { id: replacementBlockId } });
  if (!victimBlock || !replacementBlock) throw new Error('Block not found');

  // Log the victim as OVERWRITTEN
  const victimLog = await prisma.scheduleSessionLog.create({
    data: {
      userId: DEV_USER_ID,
      workspaceId: DEV_WORKSPACE_ID,
      timeBlockId: victimBlockId,
      blockTitle: victimBlock.title,
      blockColor: victimBlock.color,
      date: targetDate,
      scheduledStart: victimBlock.startTime,
      scheduledEnd: victimBlock.endTime,
      outcome: 'OVERWRITTEN',
      remark,
      remarkCategory: remarkCategory || 'OTHER',
      replacedByTitle: replacementBlock.title,
      minutesLogged: 0,
      isTriaged: true,
    },
  });

  // Log the replacement in that slot
  const replacementLog = await prisma.scheduleSessionLog.create({
    data: {
      userId: DEV_USER_ID,
      workspaceId: DEV_WORKSPACE_ID,
      timeBlockId: replacementBlockId,
      blockTitle: replacementBlock.title,
      blockColor: replacementBlock.color,
      date: targetDate,
      scheduledStart: victimBlock.startTime, // Takes victim's time slot
      scheduledEnd: victimBlock.endTime,
      outcome: 'COMPLETED',
      minutesLogged: blockDuration(victimBlock.startTime, victimBlock.endTime),
      isTriaged: true,
    },
  });

  // Link them
  await prisma.scheduleSessionLog.update({
    where: { id: victimLog.id },
    data: { replacedById: replacementLog.id },
  });

  revalidatePath('/dashboard');
}

// ====================================================================
// EXTEND BLOCK (flow state — cannibalize next block)
// ====================================================================

export async function extendBlock(currentBlockId: string, nextBlockId: string) {
  const targetDate = getMidnight(new Date());

  const nextBlock = await prisma.timeBlock.findUnique({ where: { id: nextBlockId } });
  if (!nextBlock) throw new Error('Next block not found');

  // Log the cannibalized block as EXTENDED
  await prisma.scheduleSessionLog.create({
    data: {
      userId: DEV_USER_ID,
      workspaceId: DEV_WORKSPACE_ID,
      timeBlockId: nextBlockId,
      blockTitle: nextBlock.title,
      blockColor: nextBlock.color,
      date: targetDate,
      scheduledStart: nextBlock.startTime,
      scheduledEnd: nextBlock.endTime,
      outcome: 'EXTENDED',
      remark: 'Overridden by Flow State Extension',
      remarkCategory: 'FLOW_STATE',
      minutesLogged: 0,
      isTriaged: true,
    },
  });

  revalidatePath('/dashboard');
}

// ====================================================================
// RESOLVE UNRESOLVED BLOCK (from Triage Modal)
// ====================================================================

export async function resolveUnresolvedBlock(
  logId: string,
  newOutcome: 'COMPLETED' | 'SKIPPED',
  remark?: string,
  remarkCategory?: string
) {
  const log = await prisma.scheduleSessionLog.findUnique({ where: { id: logId } });
  if (!log) throw new Error('Log not found');

  const duration = blockDuration(log.scheduledStart, log.scheduledEnd);

  await prisma.scheduleSessionLog.update({
    where: { id: logId },
    data: {
      outcome: newOutcome,
      remark: remark || log.remark,
      remarkCategory: remarkCategory || log.remarkCategory,
      minutesLogged: newOutcome === 'COMPLETED' ? duration : 0,
      isTriaged: true,
      resolvedAt: new Date(),
    },
  });

  revalidatePath('/dashboard');
}

// ====================================================================
// GET DAILY SCHEDULE SUMMARY (for CurrentBlockWidget)
// ====================================================================

export async function getDailyScheduleSummary(date?: Date) {
  const targetDate = getMidnight(date || new Date());

  const blocks = await getTodayBlocks();

  const logs = await prisma.scheduleSessionLog.findMany({
    where: {
      userId: DEV_USER_ID,
      date: targetDate,
    },
  });

  const logMap = new Map(logs.map(l => [l.timeBlockId, l]));

  return blocks.map(block => ({
    ...block,
    log: logMap.get(block.id) || null,
  }));
}

// ====================================================================
// GET WEEKLY TRIAGE SUMMARY (for Buffer Day)
// ====================================================================

export async function getWeeklyTriageSummary(weekStartDate: Date) {
  const start = getMidnight(weekStartDate);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);

  return prisma.scheduleSessionLog.findMany({
    where: {
      userId: DEV_USER_ID,
      date: { gte: start, lt: end },
      outcome: { in: ['SKIPPED', 'PRE_SKIPPED', 'INTERRUPTED', 'OVERWRITTEN', 'EXTENDED'] },
    },
    orderBy: [{ date: 'asc' }, { scheduledStart: 'asc' }],
  });
}
