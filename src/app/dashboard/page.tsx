import DashboardClient from './DashboardClient';
import { prisma } from '@/lib/db';
import { DEV_WORKSPACE_ID, DEV_USER_ID } from '@/lib/constants';
import { getUnverifiedBlocks } from '../actions/planner.actions';
import { ensureTodaySlots } from '../actions/schedule-slot.actions';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const now = new Date();

  // 1. Fetch Workspace for Routine Mode
  const workspace = await prisma.workspace.findUnique({
    where: { id: DEV_WORKSPACE_ID },
    select: { routineMode: true }
  });

  // 2. Fetch Revisions Due (Pending & Overdue)
  const pendingRevisions = await prisma.revision.findMany({
    where: {
      OR: [
        { status: 'pending', scheduledFor: { lte: now } },
        { status: 'done', completedAt: { gte: today } }
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
  });

  // Map them into a unified format for the UI
  const mappedRevisions = pendingRevisions.map(rev => {
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
        topicId: rev.capture.id, // Using note ID for routing/UI
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

  // 2. Fetch Tasks (Tasks and Reminders)
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);

  const rawTasks = await prisma.capture.findMany({
    where: {
      workspaceId: DEV_WORKSPACE_ID,
      type: 'TASK',
      isDone: false,
    },
    include: { attachments: true, category: true },
    orderBy: { dueDate: 'asc' }
  });

  const rawReminders = await prisma.reminder.findMany({
    where: {
      isDismissed: false,
      capture: { 
        workspaceId: DEV_WORKSPACE_ID,
        revisions: { none: { status: 'pending' } }
      }
    },
    include: { capture: { include: { attachments: true, category: true } } },
    orderBy: { remindAt: 'asc' }
  });

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
        source: undefined, // TASKS don't have linkedResource anymore
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

  // 3. Fetch Inbox (Captures without Subject and not TASK)
  const rawInbox = await prisma.capture.findMany({
    where: { 
      workspaceId: DEV_WORKSPACE_ID, 
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
  });

  const inboxItems = rawInbox.map(item => ({
    id: item.id,
    type: item.type === 'LINK' ? ('link' as const) : ('note' as const),
    title: item.title || item.content?.substring(0, 50) || 'Untitled',
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

  const habitsResponse = await import('@/app/actions/habit.actions').then(m => m.getHabits());
  const habits = habitsResponse.success ? habitsResponse.habits : [];

  // 4. Fetch Stats
  const user = await prisma.user.findUnique({
    where: { id: DEV_USER_ID },
    select: { globalStreak: true }
  });

  const totalTopics = await prisma.topic.count();
  
  const topicsWithRevisions = await prisma.topic.count({
    where: {
      revisions: {
        some: {}
      }
    }
  });

  const masteredTopics = await prisma.topic.count({
    where: {
      revisions: {
        some: {
          cycleNumber: { gte: 4 },
          status: 'done'
        }
      }
    }
  });

  const inProgressTopics = Math.max(0, topicsWithRevisions - masteredTopics);
  const notStartedTopics = Math.max(0, totalTopics - topicsWithRevisions);

  const totalRevisionsDone = await prisma.activityLog.count({
    where: { userId: DEV_USER_ID, action: 'COMPLETED_REVISION' }
  });

  const stats = {
    streak: user?.globalStreak || 0,
    totalTopics,
    totalRevisionsDone,
    weeklyActivity: [0, 0, 0, 0, 0, 0, 0], // Mock for now
    mastered: masteredTopics,
    inProgress: inProgressTopics,
    notStarted: notStartedTopics
  };

  // 5. Fetch/Generate Today's Schedule Slots
  const todaySlots = await ensureTodaySlots(DEV_WORKSPACE_ID, workspace?.routineMode || 'MASTER');

  // 6. Fetch Unverified Blocks
  const unverifiedBlocks = await getUnverifiedBlocks();

  return (
    <DashboardClient 
      revisions={mappedRevisions}
      tasks={tasks}
      inbox={inboxItems}
      stats={stats}
      todaySlots={todaySlots}
      unverifiedBlocks={unverifiedBlocks}
      initialRoutineMode={workspace?.routineMode || 'MASTER'}
      habits={habits}
    />
  );
}
