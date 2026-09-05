'use server';

import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import {
  getISTMidnight,
  addDays,
  differenceInISTDays,
  isSameISTDay,
} from '@/lib/date';

/** Start the spaced repetition cycle for a topic */
export async function startTopicRevisions(topicId: string) {
  const { userId, workspaceId } = await getSession();
  const intervals = [1, 3, 7, 21];
  const now = new Date();

  // Cycle 1 lands on the next IST day; later cycles are offset from there.
  const tomorrow = addDays(getISTMidnight(now), 1);

  const revisions = intervals.map((intervalDays, index) => {
    const scheduledFor = addDays(tomorrow, intervalDays - 1);

    return {
      topicId,
      cycleNumber: index + 1,
      intervalDays,
      scheduledFor,
      status: 'pending'
    };
  });

  await prisma.$transaction(async (tx) => {
    await tx.revision.createMany({
      data: revisions
    });
    
    const topic = await tx.topic.findUnique({ where: { id: topicId }, select: { subjectId: true, title: true }});
    if (topic) {
      await tx.activityLog.create({
        data: {
          userId,
          subjectId: topic.subjectId,
          topicId: topicId,
          action: 'STARTED_REVISIONS',
          details: topic.title,
        }
      });
    }
  });

  const topic = await prisma.topic.findUnique({ where: { id: topicId }, select: { subjectId: true }});
  if (topic) {
    revalidatePath(`/subject/${topic.subjectId}`);
  }
  revalidatePath(`/topic/${topicId}`);
  revalidatePath('/');
}

/** Complete a revision cycle and calculate cascading shifts */
export async function completeRevision(revisionId: string) {
  const { userId, workspaceId } = await getSession();
  const revision = await prisma.revision.findUnique({
    where: { id: revisionId },
    include: {
      topic: { select: { subjectId: true, title: true } },
      capture: { select: { subjectId: true, title: true, content: true } }
    }
  });

  if (!revision) throw new Error("Revision not found");

  const subjectId = revision.topic?.subjectId || revision.capture?.subjectId;
  const title = revision.topic?.title || revision.capture?.title || revision.capture?.content?.substring(0, 50) || "Capture";

  const now = new Date();

  await prisma.$transaction(async (tx) => {
    // 1. Mark current as done
    await tx.revision.update({
      where: { id: revisionId },
      data: { status: 'done', completedAt: now }
    });

    // 2. Snap future schedules rigidly to Spaced Repetition intervals relative to TODAY
    const today = getISTMidnight(now);
    const currentInterval = revision.intervalDays;

    const futureRevisions = await tx.revision.findMany({
      where: {
        ...(revision.topicId ? { topicId: revision.topicId } : { captureId: revision.captureId }),
        cycleNumber: { gt: revision.cycleNumber },
        status: 'pending'
      }
    });

    for (const fRev of futureRevisions) {
      const futureInterval = fRev.intervalDays;
      const daysFromToday = futureInterval - currentInterval;

      const newDate = addDays(today, daysFromToday);

      await tx.revision.update({
        where: { id: fRev.id },
        data: { scheduledFor: newDate }
      });
    }

    // 3. Activity Log
    await tx.activityLog.create({
      data: {
        userId,
        subjectId: subjectId || null,
        topicId: revision.topicId,
        action: 'COMPLETED_REVISION',
        details: `Cycle ${revision.cycleNumber} for ${title}`
      }
    });

    // 4. Update Streak & Daily History (Only if assigned to a subject)
    if (subjectId) {
      const pendingDue = await tx.revision.count({
        where: {
          OR: [
            { topic: { subjectId: subjectId } },
            { capture: { subjectId: subjectId } }
          ],
          scheduledFor: { lte: today },
          status: 'pending'
        }
      });

      let history = await tx.dailyHistory.findFirst({
        where: { userId, subjectId: subjectId, date: today }
      });

      if (!history) {
        history = await tx.dailyHistory.create({
          data: {
            userId,
            subjectId: subjectId,
            date: today,
            revisionsDue: pendingDue + 1, // We know at least one was due (or done early, but let's count it)
            revisionsDone: 1,
            streakMaintained: pendingDue === 0
          }
        });
      } else {
        history = await tx.dailyHistory.update({
          where: { id: history.id },
          data: {
            revisionsDone: history.revisionsDone + 1,
            streakMaintained: pendingDue === 0
          }
        });
      }

      // Upsert SubjectStreak
      if (pendingDue === 0) {
        const streak = await tx.subjectStreak.upsert({
          where: { userId_subjectId: { userId, subjectId: subjectId } },
          update: {}, // We'll manually increment safely
          create: { userId, subjectId: subjectId, currentStreak: 0, longestStreak: 0, lastCalculated: new Date(0) }
        });

        const yesterday = addDays(today, -1);

        if (streak.lastCalculated.getTime() < today.getTime()) {
          const isConsecutive = streak.lastCalculated.getTime() === yesterday.getTime();
          const newCurrent = isConsecutive ? streak.currentStreak + 1 : 1;
          const newLongest = Math.max(streak.longestStreak, newCurrent);

          await tx.subjectStreak.update({
            where: { userId_subjectId: { userId, subjectId: subjectId } },
            data: { currentStreak: newCurrent, longestStreak: newLongest, lastCalculated: today }
          });
        }
      }
    }

    // 5. Update Global Streak
    const globalPendingDue = await tx.revision.count({
      where: {
        OR: [
          { topic: { subject: { workspace: { userId } } } },
          { capture: { workspace: { userId } } }
        ],
        scheduledFor: { lte: today },
        status: 'pending'
      }
    });

    if (globalPendingDue === 0) {
      const user = await tx.user.findUnique({ where: { id: userId } });
      if (user) {
        const lastUpdate = user.lastGlobalStreakUpdate;
        // Compare in IST day space. The old code built a *server-local*
        // midnight from lastUpdate and diffed it against a UTC-midnight
        // `today`, so on any non-UTC host the two were hours apart and
        // Math.floor could round the gap down to 0 — silently freezing
        // the streak.
        const alreadyUpdatedToday = !!lastUpdate && isSameISTDay(lastUpdate, today);

        if (!alreadyUpdatedToday) {
           let newStreak = user.globalStreak;
           if (lastUpdate) {
               const diffDays = differenceInISTDays(today, lastUpdate);

               if (diffDays === 1) newStreak++;
               else if (diffDays > 1) newStreak = 1;
           } else {
               newStreak = 1;
           }

           await tx.user.update({
             where: { id: userId },
             data: {
               globalStreak: newStreak,
               longestGlobalStreak: Math.max(newStreak, user.longestGlobalStreak),
               lastGlobalStreakUpdate: today
             }
           });
        }
      }
    }
  });

  revalidatePath(`/subject/${subjectId}`);
  if (revision.topicId) {
    revalidatePath(`/topic/${revision.topicId}`);
  }
  revalidatePath('/');
}

/** Start the spaced repetition cycle for a Capture */
export async function startCaptureRevisions(captureId: string) {
  const { userId, workspaceId } = await getSession();
  const intervals = [1, 3, 7, 21];
  const now = new Date();

  // Cycle 1 lands on the next IST day; later cycles are offset from there.
  const tomorrow = addDays(getISTMidnight(now), 1);

  const revisions = intervals.map((intervalDays, index) => {
    const scheduledFor = addDays(tomorrow, intervalDays - 1);

    return {
      captureId,
      cycleNumber: index + 1,
      intervalDays,
      scheduledFor,
      status: 'pending'
    };
  });

  await prisma.$transaction(async (tx) => {
    await tx.revision.createMany({
      data: revisions
    });
    
    const cap = await tx.capture.findUnique({ where: { id: captureId }, select: { subjectId: true, title: true, content: true }});
    if (cap && cap.subjectId) {
      await tx.activityLog.create({
        data: {
          userId,
          subjectId: cap.subjectId,
          action: 'STARTED_REVISIONS',
          details: cap.title || cap.content?.substring(0, 50) || 'Capture',
        }
      });
    }
  });

  const cap = await prisma.capture.findUnique({ where: { id: captureId }, select: { subjectId: true }});
  if (cap && cap.subjectId) {
    revalidatePath(`/subject/${cap.subjectId}`);
  }
  revalidatePath('/');
}
