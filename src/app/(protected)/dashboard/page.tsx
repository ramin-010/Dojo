import DashboardClient from './DashboardClient';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { getUnverifiedBlocks } from '@/app/actions/planner.actions';
import { ensureTodaySlots, backfillMissedDays } from '@/app/actions/schedule-slot.actions';

import { getISTMidnight } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const { userId, workspaceId } = await getSession();
  const today = getISTMidnight();
  const now = new Date();

  // ── Phase 1: Fire ALL independent queries in parallel ─────────────────
  const [
    workspace,
    pendingRevisions,
    rawTasks,
    rawReminders,
    rawInbox,
    habitsResponse,
    user,
    totalTopics,
    topicsWithRevisions,
    masteredTopics,
    totalRevisionsDone,
    quickNotesRaw,
  ] = await Promise.all([
    // 1. Workspace
    prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { routineMode: true }
    }),

    // 2. Revisions Due (Pending & Overdue)
    prisma.revision.findMany({
      where: {
        AND: [
          {
            OR: [
              { status: 'pending', scheduledFor: { lte: now } },
              { status: 'done', completedAt: { gte: today } }
            ]
          },
          {
            OR: [
              { topic: { subject: { workspaceId } } },
              { capture: { workspaceId } }
            ]
          }
        ]
      },
      include: {
        topic: {
          include: { subject: true, tags: true }
        },
        capture: {
          include: { subject: true, category: true, attachments: true }
        }
      },
      orderBy: { scheduledFor: 'asc' }
    }),

    // 3. Tasks
    prisma.capture.findMany({
      where: {
        workspaceId: workspaceId,
        type: 'TASK',
        isDone: false,
      },
      include: { attachments: true, category: true },
      orderBy: { dueDate: 'asc' }
    }),

    // 4. Reminders
    prisma.reminder.findMany({
      where: {
        isDismissed: false,
        capture: { 
          workspaceId: workspaceId,
          revisions: { none: { status: 'pending' } }
        }
      },
      include: { capture: { include: { attachments: true, category: true } } },
      orderBy: { remindAt: 'asc' }
    }),

    // 5. Inbox
    prisma.capture.findMany({
      where: { 
        workspaceId: workspaceId, 
        subjectId: null,
        type: { in: ['NOTE', 'LINK'] },
        NOT: [
          { reminder: { isDismissed: false } },
          { revisions: { some: { status: 'pending' } } }
        ]
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: { category: true, attachments: true }
    }),

    // 6. Habits
    import('@/app/actions/habit.actions').then(m => m.getHabits()),

    // 7. User (for streak and name)
    prisma.user.findUnique({
      where: { id: userId },
      select: { globalStreak: true, name: true }
    }),

    // 8. Total Topics count
    prisma.topic.count({
      where: { subject: { workspaceId } }
    }),

    // 9. Topics with revisions count
    prisma.topic.count({
      where: { 
        subject: { workspaceId },
        revisions: { some: {} } 
      }
    }),

    // 10. Mastered topics count
    prisma.topic.count({
      where: {
        subject: { workspaceId },
        revisions: {
          some: { cycleNumber: { gte: 4 }, status: 'done' }
        }
      }
    }),

    // 11. Total revisions done count
    prisma.activityLog.count({
      where: { userId: userId, action: 'COMPLETED_REVISION' }
    }),

    // 12. Quick Notes
    prisma.quickNote.findMany({
      where: { workspaceId: workspaceId },
      orderBy: { createdAt: 'asc' }
    }),
  ]);

  // ── Phase 2: Dependent writes (need the workspace result) ─────────────
  const routineMode = workspace?.routineMode || 'MASTER';
  const backfillResult = await backfillMissedDays(routineMode);
  const todaySlots = await ensureTodaySlots(routineMode);

  // ── Phase 2b: MUST run after backfillMissedDays ───────────────────────
  // backfillMissedDays() creates the DailyScheduleSlot rows for days the
  // user never opened the app. getUnverifiedBlocks() reads those rows, so
  // running it in the Phase 1 parallel batch meant the very first load
  // after an absence saw none of the days that had just been backfilled —
  // triage only appeared on the *second* load. Keep this call here.
  const unverifiedBlocks = await getUnverifiedBlocks();

  // ── Phase 3: Pure computation (no I/O, just mapping) ──────────────────

  // Map revisions
  const seenPendingIds = new Set<string>();
  const filteredRevisions = pendingRevisions.filter(rev => {
    if (rev.status === 'done') return true; // Always show completed ones
    const identifier = rev.topicId ? `topic_${rev.topicId}` : `capture_${rev.captureId}`;
    if (seenPendingIds.has(identifier)) return false;
    seenPendingIds.add(identifier);
    return true;
  });

  const mappedRevisions = filteredRevisions.map(rev => {
    if (rev.topic) {
      return {
        id: rev.id,
        topicId: rev.topicId,
        topicTitle: rev.topic.title,
        subjectId: rev.topic.subjectId,
        subjectName: rev.topic.subject.name,
        subjectColor: rev.topic.subject.color || '#007acc',
        cycleNumber: rev.cycleNumber,
        intervalDays: rev.intervalDays,
        scheduledFor: rev.scheduledFor,
        status: rev.scheduledFor < today ? 'overdue' : 'pending',
        tags: rev.topic.tags.map(t => t.name),
        isQuickNote: false,
        isDone: rev.status === 'done'
      };
    } else if (rev.capture) {
      return {
        id: rev.id,
        topicId: rev.capture.id,
        topicTitle: rev.capture.title || rev.capture.content?.substring(0, 50) || 'Capture',
        subjectId: rev.capture.subjectId || 'general',
        subjectName: rev.capture.subject?.name || 'General',
        subjectColor: rev.capture.subject?.color || '#007acc',
        cycleNumber: rev.cycleNumber,
        intervalDays: rev.intervalDays,
        scheduledFor: rev.scheduledFor,
        status: rev.scheduledFor < today ? 'overdue' : 'pending',
        tags: rev.capture.category ? [rev.capture.category.name] : [],
        isQuickNote: true,
        isDone: rev.status === 'done',
        description: rev.capture.content,
        attachments: rev.capture.attachments?.map((a: any) => ({ url: a.url, fileType: a.fileType, fileName: a.fileName })) || []
      };
    }
    return null;
  }).filter(Boolean) as {
    id: string;
    topicId: string;
    topicTitle: string;
    subjectId: string;
    subjectName: string;
    subjectColor: string;
    cycleNumber: number;
    intervalDays: number;
    scheduledFor: Date;
    status: 'pending' | 'overdue';
    tags: string[];
    isQuickNote: boolean;
    isDone: boolean;
    description?: string | null;
    attachments?: any[];
  }[];

  // Map tasks + reminders
  const tasks = [
    ...rawTasks.map(t => {
      const isOverdue = t.dueDate && t.dueDate < today;
      return {
        id: t.id,
        title: t.title || 'Task',
        isDone: t.isDone,
        time: t.dueDate ? t.dueDate.toISOString() : undefined,
        dueDate: t.dueDate,
        type: 'task' as 'task',
        goalType: t.goalType,
        isOverdue: !!isOverdue,
        source: undefined,
        description: t.content,
        tags: t.category ? [t.category.name] : [],
        attachments: t.attachments.map(a => ({ url: a.url, fileType: a.fileType, fileName: a.fileName }))
      };
    }),
    ...rawReminders.map(r => {
      const isOverdue = r.remindAt < today;
      return {
        id: r.id,
        title: r.capture.title || r.capture.content?.substring(0, 30) || 'Reminder',
        isDone: r.isDismissed,
        time: r.remindAt.toISOString(),
        dueDate: r.remindAt,
        type: 'reminder' as 'reminder',
        isOverdue: !!isOverdue,
        source: r.capture.url ? `/dashboard/knowledge` : undefined,
        description: r.capture.content,
        tags: r.capture.category ? [r.capture.category.name] : [],
        attachments: r.capture.attachments.map(a => ({ url: a.url, fileType: a.fileType, fileName: a.fileName }))
      };
    })
  ].sort((a, b) => {
    if (!a.dueDate && !b.dueDate) return 0;
    if (!a.dueDate) return 1;
    if (!b.dueDate) return -1;
    return a.dueDate.getTime() - b.dueDate.getTime();
  });

  // Map inbox
  const inboxItems = rawInbox.map(item => ({
    id: item.id,
    type: item.type === 'LINK' ? ('link' as const) : ('note' as const),
    title: item.title || item.content?.substring(0, 50) || 'Untitled',
    description: item.content,
    url: item.url || undefined,
    createdAt: item.createdAt,
    isPinned: item.isPinned,
    tags: item.category ? [item.category.name] : [],
    attachments: item.attachments.map(a => ({ url: a.url, fileType: a.fileType, fileName: a.fileName }))
  })).sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });

  // Habits
  const habits = habitsResponse.success ? habitsResponse.habits : [];

  // Stats
  const inProgressTopics = Math.max(0, topicsWithRevisions - masteredTopics);
  const notStartedTopics = Math.max(0, totalTopics - topicsWithRevisions);

  const stats = {
    streak: user?.globalStreak || 0,
    totalTopics,
    totalRevisionsDone,
    weeklyActivity: [0, 0, 0, 0, 0, 0, 0],
    mastered: masteredTopics,
    inProgress: inProgressTopics,
    notStarted: notStartedTopics
  };

  // Quick Notes
  const quickNotes = quickNotesRaw.map(qn => ({
    ...qn,
    category: qn.category as 'PRIMARY' | 'TEMPORARY',
    attachments: qn.attachments as any
  }));

  return (
    <DashboardClient 
      revisions={mappedRevisions}
      tasks={tasks}
      inbox={inboxItems}
      quickNotes={quickNotes}
      stats={stats}
      todaySlots={todaySlots}
      unverifiedBlocks={unverifiedBlocks}
      initialRoutineMode={workspace?.routineMode || 'MASTER'}
      habits={habits}
      workspaceId={workspaceId}
      userName={user?.name || 'User'}
    />
  );
}

