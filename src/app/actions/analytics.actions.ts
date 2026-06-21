'use server';

import { prisma } from '@/lib/db';
import { DEV_USER_ID } from '@/lib/constants';

/** Get recent activity for a subject */
export async function getRecentActivity(subjectId: string, limit = 5) {
  const activities = await prisma.activityLog.findMany({
    where: { subjectId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  return activities;
}

/** Get the subject's streak info */
export async function getSubjectStreak(subjectId: string) {
  const streak = await prisma.subjectStreak.findUnique({
    where: { userId_subjectId: { userId: DEV_USER_ID, subjectId } },
  });

  return streak;
}

/** Get last 7 days of daily history for the streak chart */
export async function getDailyHistory(subjectId: string, days = 7) {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const history = await prisma.dailyHistory.findMany({
    where: {
      userId: DEV_USER_ID,
      subjectId,
      date: { gte: since },
    },
    orderBy: { date: 'asc' },
  });

  return history;
}
