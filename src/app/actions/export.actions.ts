'use server';

import { prisma } from '@/lib/db';
import {
  getISTMidnight,
  addDays,
  toISTDateString,
  getISTDayOfWeek,
  differenceInISTDays,
  eachISTDayInRange,
} from '@/lib/date';
import { getSession } from '@/lib/auth';
import {
  buildMentorPrompt,
  type ExportDay,
  type ExportBlock,
  type ExportRevision,
  type BlockStatusLike,
} from '@/lib/export/mentorReport';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/**
 * Builds the AI mentor prompt for a date range.
 *
 * Reads DailyScheduleSlot as the primary source. The previous version read
 * BlockSessionLog, which only receives rows from a few code paths —
 * backfillMissedDays() writes slots directly and never creates a log — so
 * roughly two thirds of block history was invisible to the export, and days
 * appeared inconsistently against their debriefs.
 *
 * BlockSessionLog is still merged in for (block, day) pairs that have no slot,
 * so older history survives.
 */
export async function getAiExportData(fromDate: Date, toDate: Date) {
  try {
    const { userId, workspaceId } = await getSession();

    const start = getISTMidnight(fromDate);
    const end = getISTMidnight(toDate);
    if (start > end) return { success: false, error: 'Start date is after end date' };

    // Query a day wider on each side, then filter precisely after normalising.
    // Legacy rows are stored at 18:30 of the *previous* UTC day, so a strict
    // `>= start` window would silently drop them.
    const qStart = addDays(start, -1);
    const qEnd = addDays(end, 2);

    const [slots, sessionLogs, debriefs, revisions, habits, user] = await Promise.all([
      prisma.dailyScheduleSlot.findMany({
        where: { workspaceId, date: { gte: qStart, lt: qEnd } },
        orderBy: [{ date: 'asc' }, { sortOrder: 'asc' }],
      }),
      prisma.blockSessionLog.findMany({
        where: { timeBlock: { workspaceId }, date: { gte: qStart, lt: qEnd } },
        include: { timeBlock: { select: { id: true, title: true, startTime: true, endTime: true } } },
        orderBy: [{ date: 'asc' }],
      }),
      prisma.dayDebrief.findMany({
        where: { workspaceId, date: { gte: qStart, lt: qEnd } },
      }),
      prisma.revision.findMany({
        where: {
          OR: [
            { topic: { subject: { workspaceId } } },
            { capture: { workspaceId } },
          ],
        },
        include: {
          topic: { select: { title: true, subject: { select: { name: true } } } },
          capture: { select: { title: true, content: true, subject: { select: { name: true } } } },
        },
      }),
      prisma.habit.findMany({
        where: { workspaceId },
        select: { name: true, currentStreak: true, longestStreak: true },
      }),
      prisma.user.findUnique({ where: { id: userId }, select: { globalStreak: true } }),
    ]);

    // ── Index everything by IST day string ──────────────────────────
    const blocksByDay = new Map<string, ExportBlock[]>();
    const slotKeys = new Set<string>(); // `${day}|${sourceBlockId}` to dedupe logs

    for (const s of slots) {
      const day = toISTDateString(s.date);
      const list = blocksByDay.get(day) ?? [];
      list.push({
        title: s.title,
        startTime: s.startTime,
        endTime: s.endTime,
        status: s.status as BlockStatusLike,
        remark: s.remark,
        minutesDone: s.minutesDone,
        actualStartTime: s.actualStartTime,
        actualEndTime: s.actualEndTime,
      });
      blocksByDay.set(day, list);
      if (s.sourceBlockId) slotKeys.add(`${day}|${s.sourceBlockId}`);
    }

    // Merge in session logs that no slot covers (older history).
    for (const l of sessionLogs) {
      const day = toISTDateString(l.date);
      if (slotKeys.has(`${day}|${l.timeBlockId}`)) continue;
      const list = blocksByDay.get(day) ?? [];
      list.push({
        title: l.timeBlock.title,
        startTime: l.timeBlock.startTime,
        endTime: l.timeBlock.endTime,
        status: l.status as BlockStatusLike,
        remark: l.remark,
        minutesDone: l.minutesDone,
        actualStartTime: null,
        actualEndTime: null,
      });
      blocksByDay.set(day, list);
    }

    for (const list of blocksByDay.values()) {
      list.sort((a, b) => a.startTime.localeCompare(b.startTime));
    }

    const debriefByDay = new Map(debriefs.map((d) => [toISTDateString(d.date), d]));

    // ── Revisions ───────────────────────────────────────────────────
    const titleOf = (r: (typeof revisions)[number]) =>
      r.topic?.title ||
      r.capture?.title ||
      r.capture?.content?.slice(0, 40) ||
      'Untitled';
    const subjectOf = (r: (typeof revisions)[number]) =>
      r.topic?.subject?.name || r.capture?.subject?.name || 'General';

    const revisionsByDay = new Map<string, ExportRevision[]>();
    const pendingRevisions: ExportRevision[] = [];

    for (const r of revisions) {
      const base = {
        title: titleOf(r),
        subject: subjectOf(r),
        cycleNumber: r.cycleNumber,
        scheduledFor: toISTDateString(r.scheduledFor),
      };

      if (r.status === 'done' && r.completedAt) {
        const day = toISTDateString(r.completedAt);
        if (day < toISTDateString(start) || day > toISTDateString(end)) continue;
        const list = revisionsByDay.get(day) ?? [];
        list.push({
          ...base,
          completedOn: day,
          daysLate: differenceInISTDays(r.completedAt, r.scheduledFor),
        });
        revisionsByDay.set(day, list);
      } else if (r.status === 'pending') {
        pendingRevisions.push({ ...base, completedOn: null, daysLate: null });
      }
    }

    // ── Assemble one entry per calendar day, gaps included ───────────
    const days: ExportDay[] = eachISTDayInRange(start, end).map((d) => {
      const key = toISTDateString(d);
      const db = debriefByDay.get(key);
      return {
        date: key,
        weekday: WEEKDAYS[getISTDayOfWeek(d)],
        blocks: blocksByDay.get(key) ?? [],
        revisionsCompleted: revisionsByDay.get(key) ?? [],
        debrief: db
          ? {
              energy: db.energy,
              focus: db.focus,
              mood: db.mood,
              tags: db.tags ?? [],
              narrative: db.narrative,
              tomorrowIntent: db.tomorrowIntent,
              freeWrite: db.freeWrite,
            }
          : null,
      };
    });

    const data = buildMentorPrompt({
      from: toISTDateString(start),
      to: toISTDateString(end),
      days,
      pendingRevisions,
      habits,
      globalStreak: user?.globalStreak ?? 0,
    });

    return { success: true, data };
  } catch (error) {
    console.error('Failed to get export data:', error);
    return { success: false, error: 'Failed to generate export' };
  }
}
