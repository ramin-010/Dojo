'use server';

import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { DEV_USER_ID } from '@/lib/constants';
import { revalidatePath } from 'next/cache';
import { v2 as cloudinary } from 'cloudinary';

// Configure cloudinary for the server action
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

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

/** Fetch only resources for a topic */
export async function getTopicResources(topicId: string) {
  return await prisma.resourceLink.findMany({
    where: { topicId },
    orderBy: { createdAt: 'desc' },
  });
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

/** Get the previous and next topics for navigation */
export async function getAdjacentTopics(subjectId: string, currentTopicId: string) {
  const allTopics = await prisma.topic.findMany({
    where: { subjectId },
    orderBy: [
      { sortOrder: 'asc' },
      { createdAt: 'asc' }
    ],
    select: { id: true, title: true }
  });

  const currentIndex = allTopics.findIndex(t => t.id === currentTopicId);
  
  if (currentIndex === -1) {
    return { prevTopic: null, nextTopic: null };
  }

  const prevTopic = currentIndex > 0 ? allTopics[currentIndex - 1] : null;
  const nextTopic = currentIndex < allTopics.length - 1 ? allTopics[currentIndex + 1] : null;

  return { prevTopic, nextTopic };
}

/** Permanently delete a resource link from DB and Cloudinary */
export async function deleteResourcePermanently(resourceIdOrUrl: string) {
  // 1. Find the resource (by ID or exact URL)
  const isUrl = resourceIdOrUrl.startsWith('http');
  const resource = isUrl 
    ? await prisma.resourceLink.findFirst({
        where: { url: resourceIdOrUrl },
        select: { id: true, cloudPublicId: true, subjectId: true, topicId: true }
      })
    : await prisma.resourceLink.findUnique({
        where: { id: resourceIdOrUrl },
        select: { id: true, cloudPublicId: true, subjectId: true, topicId: true }
      });

  if (!resource) return { success: false, error: 'Resource not found' };

  // 2. Delete from Cloudinary if it's a cloud asset
  if (resource.cloudPublicId) {
    try {
      await new Promise<void>((resolve, reject) => {
        cloudinary.uploader.destroy(resource.cloudPublicId!, { invalidate: true }, (err: any, result: any) => {
          if (err) {
            console.error("[Actions] Cloud deletion error:", err);
            reject(err);
          } else {
            console.log("[Actions] Cloud deletion result:", result);
            resolve();
          }
        });
      });
    } catch (e) {
      console.error('[Actions] Failed to delete from cloudinary:', e);
    }
  }

  // 3. Delete from Database
  try {
    await prisma.resourceLink.delete({
      where: { id: resource.id }
    });
    
    if (resource.topicId) revalidatePath(`/topic/${resource.topicId}`);
    revalidatePath(`/subject/${resource.subjectId}`);
    return { success: true };
  } catch (error) {
    console.error('Error permanently deleting resource:', error);
    return { success: false, error: 'Failed to delete resource' };
  }
}

/** Permanently delete multiple resources */
export async function deleteMultipleResourcesPermanently(resourceIds: string[]) {
  const resources = await prisma.resourceLink.findMany({
    where: { id: { in: resourceIds } },
    select: { id: true, cloudPublicId: true, subjectId: true, topicId: true }
  });

  if (!resources.length) return { success: false, error: 'No resources found' };

  for (const resource of resources) {
    if (resource.cloudPublicId) {
      try {
        await new Promise<void>((resolve, reject) => {
          cloudinary.uploader.destroy(resource.cloudPublicId!, { invalidate: true }, (err: any) => {
            if (err) reject(err);
            else resolve();
          });
        });
      } catch (e) {
        console.error(`[Actions] Failed to delete ${resource.id} from cloudinary:`, e);
      }
    }
  }

  try {
    await prisma.resourceLink.deleteMany({
      where: { id: { in: resourceIds } }
    });
    
    if (resources[0].topicId) revalidatePath(`/topic/${resources[0].topicId}`);
    revalidatePath(`/subject/${resources[0].subjectId}`);
    return { success: true };
  } catch (error) {
    console.error('Error permanently deleting resources:', error);
    return { success: false, error: 'Failed to delete resources' };
  }
}

/** Rename a resource */
export async function renameResource(id: string, newTitle: string) {
  const resource = await prisma.resourceLink.update({
    where: { id },
    data: { title: newTitle }
  });
  if (resource.topicId) revalidatePath(`/topic/${resource.topicId}`);
  revalidatePath(`/subject/${resource.subjectId}`);
  return resource;
}

/** Create a resource link or text note from the editor */
export async function createTextResourceLink(
  topicId: string,
  content: string,
  type: 'url' | 'text'
) {
  const topic = await prisma.topic.findUnique({
    where: { id: topicId },
    select: { subjectId: true },
  });
  
  if (!topic) throw new Error('Topic not found');

  let title = content;
  let url = content;
  const category = 'link'; // Always 'link' for anything created via => shortcut

  if (type === 'url') {
    try {
      title = new URL(content).hostname;
    } catch(e) {}
  } else {
    url = ''; // Text resources don't have a URL
  }

  const resource = await prisma.resourceLink.create({
    data: {
      subjectId: topic.subjectId,
      topicId: topicId,
      isSubjectLevel: false,
      url: url,
      title: title,
      category: category,
    }
  });

  revalidatePath(`/topic/${topicId}`);
  return { type: 'resource', data: resource };
}

