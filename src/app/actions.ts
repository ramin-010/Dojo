'use server';

import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { DEV_USER_ID, DEV_WORKSPACE_ID } from '@/lib/constants';
import { revalidatePath } from 'next/cache';

// ====================================================================
// SUBJECT ACTIONS
// ====================================================================

/** Fetch all subjects with their topics for the sidebar */
export async function getSubjectsWithTopics() {
  const subjects = await prisma.subject.findMany({
    where: { workspaceId: DEV_WORKSPACE_ID },
    include: {
      topics: {
        select: {
          id: true,
          title: true,
          sortOrder: true,
          updatedAt: true,
        },
        orderBy: { sortOrder: 'asc' },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  return subjects;
}

/** Fetch a single subject with full details for the profile page */
export async function getSubjectById(subjectId: string) {
  const subject = await prisma.subject.findUnique({
    where: { id: subjectId },
    include: {
      topics: {
        select: {
          id: true,
          title: true,
          tags: true,
          sortOrder: true,
          updatedAt: true,
          revisions: {
            select: {
              id: true,
              cycleNumber: true,
              status: true,
              scheduledFor: true,
            },
          },
        },
        orderBy: { sortOrder: 'asc' },
      },
      resources: {
        where: { isSubjectLevel: true },
        orderBy: { createdAt: 'desc' },
      },
      quickNotes: {
        where: { isSubjectLevel: true },
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  return subject;
}

/** Create a new subject */
export async function createSubject(name: string, description?: string, color?: string) {
  const subject = await prisma.subject.create({
    data: {
      workspaceId: DEV_WORKSPACE_ID,
      name,
      description,
      color,
    },
  });

  revalidatePath('/dashboard');
  revalidatePath('/');
  return subject;
}

/** Update a subject's details */
export async function updateSubject(
  subjectId: string,
  data: { name?: string; description?: string; color?: string; icon?: string }
) {
  const subject = await prisma.subject.update({
    where: { id: subjectId },
    data,
  });

  revalidatePath(`/subject/${subjectId}`);
  revalidatePath('/');
  return subject;
}

/** Delete a subject and all its children */
export async function deleteSubject(subjectId: string) {
  await prisma.subject.delete({
    where: { id: subjectId },
  });

  revalidatePath('/dashboard');
  revalidatePath('/');
}

// ====================================================================
// TOPIC ACTIONS
// ====================================================================

/** Create a new topic inside a subject */
export async function createTopic(subjectId: string, title: string) {
  // Get the highest sortOrder to place this topic at the end
  const lastTopic = await prisma.topic.findFirst({
    where: { subjectId },
    orderBy: { sortOrder: 'desc' },
    select: { sortOrder: true },
  });

  const sortOrder = (lastTopic?.sortOrder ?? 0) + 1;

  const topic = await prisma.topic.create({
    data: {
      subjectId,
      title,
      sortOrder,
      canvasData: { blocks: [], connections: [] },
    },
  });

  // Log the activity
  await prisma.activityLog.create({
    data: {
      userId: DEV_USER_ID,
      subjectId,
      topicId: topic.id,
      action: 'CREATED_TOPIC',
      details: title,
    },
  });

  // Update subject's lastActiveAt
  await prisma.subject.update({
    where: { id: subjectId },
    data: { lastActiveAt: new Date() },
  });

  revalidatePath(`/subject/${subjectId}`);
  revalidatePath('/');
  return topic;
}

/** Fetch a single topic with its full canvas data */
export async function getTopicById(topicId: string) {
  const topic = await prisma.topic.findUnique({
    where: { id: topicId },
    include: {
      subject: {
        select: { id: true, name: true },
      },
      revisions: {
        orderBy: { cycleNumber: 'asc' },
      },
      mentionsOut: {
        include: {
          targetTopic: {
            select: { id: true, title: true, updatedAt: true },
          },
        },
      },
      mentionsIn: {
        include: {
          sourceTopic: {
            select: { id: true, title: true, updatedAt: true },
          },
        },
      },
      resources: {
        orderBy: { createdAt: 'desc' },
      },
      quickNotes: {
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  return topic;
}

/** Save canvas data for a topic (the debounced auto-save target) */
export async function saveCanvasData(
  topicId: string,
  canvasData: object,
  extractedMentions?: string[]
) {
  // Optimistic concurrency: check updatedAt if needed
  await prisma.$transaction(async (tx) => {
    // 1. Update the canvas JSON
    await tx.topic.update({
      where: { id: topicId },
      data: {
        canvasData: canvasData as Prisma.InputJsonValue,
        updatedAt: new Date(),
      },
    });

    // 2. Refresh mentions if provided
    if (extractedMentions) {
      await tx.topicMention.deleteMany({
        where: { sourceTopicId: topicId },
      });

      if (extractedMentions.length > 0) {
        await tx.topicMention.createMany({
          data: extractedMentions.map((targetId) => ({
            sourceTopicId: topicId,
            targetTopicId: targetId,
          })),
          skipDuplicates: true,
        });
      }
    }
  });

  // Update the parent subject's lastActiveAt
  const topic = await prisma.topic.findUnique({
    where: { id: topicId },
    select: { subjectId: true },
  });

  if (topic) {
    await prisma.subject.update({
      where: { id: topic.subjectId },
      data: { lastActiveAt: new Date() },
    });
  }
}

/** Update a topic's metadata (title, tags) */
export async function updateTopic(
  topicId: string,
  data: { title?: string; tags?: string[] }
) {
  const topic = await prisma.topic.update({
    where: { id: topicId },
    data,
  });

  revalidatePath(`/topic/${topicId}`);
  revalidatePath(`/subject/${topic.subjectId}`);
  revalidatePath('/');
  return topic;
}

/** Delete a topic */
export async function deleteTopic(topicId: string) {
  const topic = await prisma.topic.findUnique({
    where: { id: topicId },
    select: { subjectId: true },
  });
  if (!topic) return;

  await prisma.topic.delete({
    where: { id: topicId },
  });

  if (topic) {
    revalidatePath(`/subject/${topic.subjectId}`);
  }
  revalidatePath('/');
}

/** Reorder topics within a subject */
export async function reorderTopics(
  subjectId: string,
  topicIds: string[]
) {
  await prisma.$transaction(
    topicIds.map((id, index) =>
      prisma.topic.update({
        where: { id },
        data: { sortOrder: index + 1 },
      })
    )
  );

  revalidatePath(`/subject/${subjectId}`);
  revalidatePath('/');
}

// ====================================================================
// ACTIVITY & STREAK ACTIONS
// ====================================================================

/** Get recent activity for a subject */
export async function getRecentActivity(subjectId: string, limit = 5) {
  const activities = await prisma.activityLog.findMany({
    where: { subjectId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  return activities;
}

/** Get the user's streak info */
export async function getUserStreak() {
  const streak = await prisma.userStreak.findUnique({
    where: { userId: DEV_USER_ID },
  });

  return streak;
}

/** Get last 7 days of daily history for the streak chart */
export async function getDailyHistory(days = 7) {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const history = await prisma.dailyHistory.findMany({
    where: {
      userId: DEV_USER_ID,
      date: { gte: since },
    },
    orderBy: { date: 'asc' },
  });

  return history;
}

/** Mark a specific revision as completed */
export async function completeRevision(revisionId: string) {
  const revision = await prisma.revision.update({
    where: { id: revisionId },
    data: {
      status: 'done',
      completedAt: new Date(),
    },
    include: { topic: { select: { id: true, title: true, subjectId: true } } },
  });

  // Log the activity
  await prisma.activityLog.create({
    data: {
      userId: DEV_USER_ID,
      subjectId: revision.topic.subjectId,
      topicId: revision.topic.id,
      action: 'COMPLETED_REVISION',
      details: revision.topic.title,
    },
  });

  // Update subject lastActiveAt
  await prisma.subject.update({
    where: { id: revision.topic.subjectId },
    data: { lastActiveAt: new Date() },
  });

  revalidatePath(`/topic/${revision.topic.id}`);
  revalidatePath(`/subject/${revision.topic.subjectId}`);
  revalidatePath('/dashboard');
  revalidatePath('/');
  return revision;
}

// ==========================================
// WORKSPACE SETTINGS ACTIONS
// ==========================================

export async function getWorkspaceSettings() {
  const workspace = await prisma.workspace.findFirst({
    select: {
      id: true,
      spacedRepetitionIntervals: true
    }
  });
  
  if (!workspace) {
    throw new Error('Workspace not found');
  }
  
  return workspace;
}

export async function updateWorkspaceSchedule(workspaceId: string, intervals: number[]) {
  // Sort the intervals
  const sortedIntervals = [...intervals].sort((a, b) => a - b);
  
  const updated = await prisma.workspace.update({
    where: { id: workspaceId },
    data: {
      spacedRepetitionIntervals: sortedIntervals
    }
  });
  
  revalidatePath('/dashboard');
  revalidatePath('/');
  return updated;
}
