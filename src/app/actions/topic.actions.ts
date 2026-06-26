'use server';

import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { DEV_USER_ID, DEV_WORKSPACE_ID } from '@/lib/constants';
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
            select: { id: true, title: true, updatedAt: true, subjectId: true, subject: { select: { name: true } } },
          },
        },
      },
      mentionsIn: {
        include: {
          sourceTopic: {
            select: { id: true, title: true, updatedAt: true, subjectId: true, subject: { select: { name: true } } },
          },
        },
      },
      resources: {
        orderBy: { createdAt: 'desc' },
      },
      quickNotes: {
        include: {
          category: true,
        },
        orderBy: [
          { isPinned: 'desc' },
          { createdAt: 'desc' }
        ],
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
import { extractCloudinaryPublicId } from '@/lib/utils/cloudinary';

/** Delete a topic */
export async function deleteTopic(topicId: string) {
  const topic = await prisma.topic.findUnique({
    where: { id: topicId },
    include: { resources: true },
  });

  if (!topic) return;

  const publicIdsToDelete = new Set<string>();

  // 1. Extract from resources
  if (topic.resources) {
    for (const res of topic.resources) {
      if (res.cloudPublicId) {
        publicIdsToDelete.add(res.cloudPublicId);
      } else if (res.url) {
        const extracted = extractCloudinaryPublicId(res.url);
        if (extracted) publicIdsToDelete.add(extracted);
      }
    }
  }

  // 2. Extract from canvasData
  const canvasData: any = topic.canvasData || { blocks: [] };
  const blocks = canvasData.blocks || [];
  
  for (const block of blocks) {
    if (block.type === 'image' && block.url) {
      const extracted = extractCloudinaryPublicId(block.url);
      if (extracted) publicIdsToDelete.add(extracted);
    }
    
    if (block.metadata?.sourceImages && Array.isArray(block.metadata.sourceImages)) {
      for (const url of block.metadata.sourceImages) {
        const extracted = extractCloudinaryPublicId(url);
        if (extracted) publicIdsToDelete.add(extracted);
      }
    }
  }

  // 3. Delete from Cloudinary (with Reference Checking)
  if (publicIdsToDelete.size > 0) {
    const promises = Array.from(publicIdsToDelete).map(async (publicId) => {
      // Pre-Deletion Reference Check
      
      // Check 1: Are there any other ResourceLinks using this publicId?
      const resourceRefs = await prisma.resourceLink.count({
        where: {
          cloudPublicId: publicId,
          topicId: { not: topicId }
        }
      });

      // Check 2: Are there any other Topics embedding this URL in their canvasData?
      // We use a raw text search on the JSON column to be absolutely sure.
      const topicRefs: any[] = await prisma.$queryRaw`
        SELECT id FROM "Topic"
        WHERE id != ${topicId}
        AND "canvasData"::text LIKE ${`%${publicId}%`}
        LIMIT 1
      `;

      if (resourceRefs === 0 && topicRefs.length === 0) {
        // Safe to destroy! We run both image and raw to catch any file type
        try {
          await cloudinary.uploader.destroy(publicId, { invalidate: true, resource_type: 'image' });
          await cloudinary.uploader.destroy(publicId, { invalidate: true, resource_type: 'raw' });
        } catch (e) {
          console.error(`Failed to destroy Cloudinary asset: ${publicId}`, e);
        }
      } else {
        console.log(`Skipping deletion for ${publicId} - referenced by other topics.`);
      }
    });

    await Promise.allSettled(promises);
  }

  // 4. Delete ActivityLogs
  await prisma.activityLog.deleteMany({
    where: { topicId },
  });

  // 5. Delete Topic (Cascades the rest)
  await prisma.topic.delete({
    where: { id: topicId },
  });

  revalidatePath(`/subject/${topic.subjectId}`);
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
      workspaceId: DEV_WORKSPACE_ID,
      subjectId: topic.subjectId,
      topicId: topicId,
      url: url,
      title: title,
      category: category,
    }
  });

  revalidatePath(`/topic/${topicId}`);
  return { type: 'resource', data: resource };
}

/** Instantly create a TopicMention record */
export async function addTopicMention(sourceTopicId: string, targetTopicId: string) {
  if (sourceTopicId === targetTopicId) {
    return { success: false, error: 'Cannot link a topic to itself' };
  }
  
  try {
    const mention = await prisma.topicMention.create({
      data: {
        sourceTopicId,
        targetTopicId,
      }
    });
    revalidatePath(`/topic/${sourceTopicId}`);
    revalidatePath(`/topic/${targetTopicId}`);
    return { success: true, mention };
  } catch (error: any) {
    // If it already exists (Unique constraint violation P2002), we consider it a success
    if (error.code === 'P2002') {
      return { success: true, message: 'Already exists' };
    }
    console.error('[Actions] Error adding topic mention:', error);
    return { success: false, error: 'Failed to add mention' };
  }
}

/** Permanently delete a TopicMention record */
export async function deleteTopicMention(id: string) {
  try {
    const mention = await prisma.topicMention.delete({
      where: { id }
    });
    revalidatePath(`/topic/${mention.sourceTopicId}`);
    revalidatePath(`/topic/${mention.targetTopicId}`);
    return { success: true };
  } catch (error) {
    console.error('[Actions] Error deleting topic mention:', error);
    return { success: false, error: 'Failed to delete mention' };
  }
}

/** Search topics within a specific subject */
export async function searchTopicsInSubject(subjectId: string, query: string, excludeTopicId?: string) {
  return await prisma.topic.findMany({
    where: {
      subjectId,
      id: excludeTopicId ? { not: excludeTopicId } : undefined,
      title: { contains: query, mode: 'insensitive' }
    },
    select: { id: true, title: true },
    take: 10,
    orderBy: { updatedAt: 'desc' }
  });
}

/** Search all subjects */
export async function searchAllSubjects(query: string) {
  return await prisma.subject.findMany({
    where: {
      name: { contains: query, mode: 'insensitive' }
    },
    select: { id: true, name: true, color: true },
    take: 10,
    orderBy: { lastActiveAt: 'desc' }
  });
}

/** Fetch all subjects for the dropdown */
export async function getAllSubjectsForMention() {
  return await prisma.subject.findMany({
    select: { id: true, name: true, color: true },
    orderBy: { lastActiveAt: 'desc' }
  });
}

/** Fetch all topics for a specific subject for the dropdown */
export async function getAllTopicsInSubjectForMention(subjectId: string, excludeTopicId?: string) {
  return await prisma.topic.findMany({
    where: { 
      subjectId,
      id: excludeTopicId ? { not: excludeTopicId } : undefined
    },
    select: { id: true, title: true, subjectId: true, subject: { select: { name: true } } },
    orderBy: { updatedAt: 'desc' }
  });
}

/** Move topic to a different subject */
export async function moveTopicToSubject(topicId: string, newSubjectId: string) {
  await prisma.topic.update({
    where: { id: topicId },
    data: { subjectId: newSubjectId }
  });
  revalidatePath('/dashboard');
}

/** Archive a topic */
export async function archiveTopic(topicId: string) {
  await prisma.topic.update({
    where: { id: topicId },
    data: { isArchived: true }
  });
  revalidatePath('/dashboard');
}

/** Unarchive a topic */
export async function unarchiveTopic(topicId: string) {
  await prisma.topic.update({
    where: { id: topicId },
    data: { isArchived: false }
  });
  revalidatePath('/dashboard');
}

/** Duplicate a topic */
export async function duplicateTopic(topicId: string) {
  const original = await prisma.topic.findUnique({
    where: { id: topicId },
    include: { resources: true }
  });
  if (!original) throw new Error("Topic not found");
  
  const lastTopic = await prisma.topic.findFirst({
    where: { subjectId: original.subjectId },
    orderBy: { sortOrder: 'desc' },
    select: { sortOrder: true },
  });
  const sortOrder = (lastTopic?.sortOrder ?? 0) + 1;
  
  const copy = await prisma.topic.create({
    data: {
      subjectId: original.subjectId,
      title: `${original.title} (Copy)`,
      sortOrder,
      canvasData: original.canvasData ?? { blocks: [], connections: [] },
      resources: {
        create: original.resources.map(r => ({
          workspaceId: r.workspaceId,
          title: r.title,
          url: r.url,
          category: r.category,
          cloudPublicId: r.cloudPublicId,
          fileType: r.fileType,
        }))
      }
    }
  });
  
  revalidatePath('/dashboard');
  return copy.id;
}
