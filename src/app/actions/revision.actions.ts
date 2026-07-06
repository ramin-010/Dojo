'use server';

import { prisma } from '@/lib/db';
import { DEV_USER_ID } from '@/lib/constants';
import { revalidatePath } from 'next/cache';

/** Start the spaced repetition cycle for a topic */
export async function startTopicRevisions(topicId: string) {
  const intervals = [1, 3, 7, 21];
  const now = new Date();
  
  // Midnight of next day
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);

  const revisions = intervals.map((intervalDays, index) => {
    const scheduledFor = new Date(tomorrow);
    scheduledFor.setDate(scheduledFor.getDate() + (intervalDays - 1));
    
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
          userId: DEV_USER_ID,
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

  if (!subjectId) throw new Error("Revision must belong to a subject to maintain streaks");

  const now = new Date();

  await prisma.$transaction(async (tx) => {
    // 1. Mark current as done
    await tx.revision.update({
      where: { id: revisionId },
      data: { status: 'done', completedAt: now }
    });

    // 3. Activity Log
    await tx.activityLog.create({
      data: {
        userId: DEV_USER_ID,
        subjectId: subjectId,
        topicId: revision.topicId,
        action: 'COMPLETED_REVISION',
        details: `Cycle ${revision.cycleNumber} for ${title}`
      }
    });

    // 4. Update Streak & Daily History
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);

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
      where: { userId: DEV_USER_ID, subjectId: subjectId, date: today }
    });

    if (!history) {
      history = await tx.dailyHistory.create({
        data: {
          userId: DEV_USER_ID,
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
        where: { userId_subjectId: { userId: DEV_USER_ID, subjectId: subjectId } },
        create: {
          userId: DEV_USER_ID,
          subjectId: subjectId,
          currentStreak: 1,
          longestStreak: 1,
          lastCalculated: today
        },
        update: {
          currentStreak: { increment: 1 },
          lastCalculated: today
        }
      });
      
      if (streak.currentStreak > streak.longestStreak) {
        await tx.subjectStreak.update({
          where: { userId_subjectId: { userId: DEV_USER_ID, subjectId: subjectId } },
          data: { longestStreak: streak.currentStreak }
        });
      }
    }

    // 5. Update Global Streak
    const globalPendingDue = await tx.revision.count({
      where: {
        OR: [
          { topic: { subject: { workspace: { userId: DEV_USER_ID } } } },
          { capture: { workspace: { userId: DEV_USER_ID } } }
        ],
        scheduledFor: { lte: today },
        status: 'pending'
      }
    });

    if (globalPendingDue === 0) {
      const user = await tx.user.findUnique({ where: { id: DEV_USER_ID } });
      if (user) {
        const lastUpdate = user.lastGlobalStreakUpdate;
        const alreadyUpdatedToday = lastUpdate && 
          lastUpdate.getDate() === today.getDate() && 
          lastUpdate.getMonth() === today.getMonth() && 
          lastUpdate.getFullYear() === today.getFullYear();
        
        if (!alreadyUpdatedToday) {
           let newStreak = user.globalStreak;
           if (lastUpdate) {
               // Calculate days since last update
               const lastDay = new Date(lastUpdate.getFullYear(), lastUpdate.getMonth(), lastUpdate.getDate());
               const diffTime = today.getTime() - lastDay.getTime();
               const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
               
               if (diffDays === 1) newStreak++;
               else if (diffDays > 1) newStreak = 1;
           } else {
               newStreak = 1;
           }

           await tx.user.update({
             where: { id: DEV_USER_ID },
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
  const intervals = [1, 3, 7, 21];
  const now = new Date();
  
  // Midnight of next day
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);

  const revisions = intervals.map((intervalDays, index) => {
    const scheduledFor = new Date(tomorrow);
    scheduledFor.setDate(scheduledFor.getDate() + (intervalDays - 1));
    
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
          userId: DEV_USER_ID,
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
