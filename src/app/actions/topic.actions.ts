'use server';

import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { DEV_USER_ID } from '@/lib/constants';
import { revalidatePath } from 'next/cache';

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
      tags: { select: { id: true, name: true } },
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
  // 1. Update the canvas JSON
  await prisma.topic.update({
    where: { id: topicId },
    data: {
      canvasData: canvasData as Prisma.InputJsonValue,
      updatedAt: new Date(),
    },
  });

  // 2. Refresh mentions if provided
  if (extractedMentions) {
    await prisma.topicMention.deleteMany({
      where: { sourceTopicId: topicId },
    });

    if (extractedMentions.length > 0) {
      await prisma.topicMention.createMany({
        data: extractedMentions.map((targetId) => ({
          sourceTopicId: topicId,
          targetTopicId: targetId,
        })),
        skipDuplicates: true,
      });
    }
  }

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
  // Fetch subjectId to scope the tags
  const topicContext = await prisma.topic.findUnique({
    where: { id: topicId },
    select: { subjectId: true }
  });
  if (!topicContext) throw new Error("Topic not found");

  const updateData: Prisma.TopicUpdateInput = {};
  if (data.title !== undefined) updateData.title = data.title;
  
  if (data.tags !== undefined) {
    updateData.tags = {
      set: [], // Unlink previous tags
      connectOrCreate: data.tags.map(tagName => ({
        where: { subjectId_name: { subjectId: topicContext.subjectId, name: tagName } },
        create: { subjectId: topicContext.subjectId, name: tagName }
      }))
    };
  }

  const topic = await prisma.topic.update({
    where: { id: topicId },
    data: updateData,
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
