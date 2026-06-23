'use server';

import { prisma } from '@/lib/db';
import { DEV_WORKSPACE_ID } from '@/lib/constants';
import { revalidatePath } from 'next/cache';

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
        where: { topicId: null },
        orderBy: { createdAt: 'desc' },
      },
      quickNotes: {
        where: { topicId: null },
        orderBy: { createdAt: 'desc' },
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
