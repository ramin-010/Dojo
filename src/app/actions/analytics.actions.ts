'use server';

import { prisma } from '@/lib/db';
import { getISTMidnight, addDays } from '@/lib/date';
import { getSession } from '@/lib/auth';

/** Get recent activity for a subject */
export async function getRecentActivity(subjectId: string, limit = 5) {
  const { userId } = await getSession();
  const activities = await prisma.activityLog.findMany({
    where: { subjectId, userId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  return activities;
}

/** Get the subject's streak info */
export async function getSubjectStreak(subjectId: string) {
  const { userId, workspaceId } = await getSession();
  const streak = await prisma.subjectStreak.findUnique({
    where: { userId_subjectId: { userId, subjectId } },
  });

  return streak;
}

/** Get last 7 days of daily history for the streak chart */
export async function getDailyHistory(subjectId: string, days = 7) {
  const { userId, workspaceId } = await getSession();
  const since = addDays(getISTMidnight(), -days);

  const history = await prisma.dailyHistory.findMany({
    where: {
      userId,
      subjectId,
      date: { gte: since },
    },
    orderBy: { date: 'asc' },
  });

  return history;
}
