'use server';

import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

/** Fetch all subjects with their topics for the sidebar */
export async function getSubjectsWithTopics() {
  const { userId, workspaceId } = await getSession();
  const subjects = await prisma.subject.findMany({
    where: { workspaceId },
    include: {
      topics: {
        select: {
          id: true,
          title: true,
          sortOrder: true,
          updatedAt: true,
          isArchived: true,
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
  const { workspaceId } = await getSession();
  const subject = await prisma.subject.findFirst({
    where: { id: subjectId, workspaceId },
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
      captures: {
        where: { topicId: null },
        orderBy: { createdAt: 'desc' },
        include: {
          category: true,
          reminder: true,
          revisions: {
            select: {
              id: true,
              cycleNumber: true,
              status: true,
              scheduledFor: true,
            }
          }
        }
      },
    },
  });

  if (!subject) return null;

  // Map Tag objects back to string arrays for the subject dashboard UI
  return {
    ...subject,
    topics: subject.topics.map(topic => ({
      ...topic,
      tags: topic.tags.map(t => t.name),
    })),
  };
}

/** Create a new subject */
export async function createSubject(name: string, description?: string, color?: string) {
  const { userId, workspaceId } = await getSession();
  const subject = await prisma.subject.create({
    data: {
      workspaceId,
      name,
      description,
      color,
    },
  });

  await prisma.activityLog.create({
    data: {
      userId,
      subjectId: subject.id,
      action: 'CREATED_SUBJECT',
      details: name
    }
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
  const { workspaceId } = await getSession();
  // updateMany applies the workspace filter; a foreign id becomes a no-op.
  const { count } = await prisma.subject.updateMany({
    where: { id: subjectId, workspaceId },
    data,
  });
  if (count === 0) throw new Error('Subject not found');
  const subject = await prisma.subject.findFirst({
    where: { id: subjectId, workspaceId },
  });

  revalidatePath(`/subject/${subjectId}`);
  revalidatePath('/');
  return subject;
}

/** Delete a subject and all its children */
export async function deleteSubject(subjectId: string) {
  const { userId, workspaceId } = await getSession();
  const subject = await prisma.subject.delete({
    where: { id: subjectId },
  });

  await prisma.activityLog.create({
    data: {
      userId,
      action: 'DELETED_SUBJECT',
      details: subject.name
    }
  });

  revalidatePath('/dashboard');
  revalidatePath('/');
}
