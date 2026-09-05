'use server';

import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';

/** Search tags for autocomplete within a subject */
export async function searchTags(subjectId: string, query: string) {
  const { workspaceId } = await getSession();
  if (!query.trim()) return [];
  // subjectId arrives from the client, so constrain it to this workspace
  // rather than trusting it to name one of our subjects.
  return await prisma.tag.findMany({
    where: {
      subjectId,
      subject: { workspaceId },
      name: {
        contains: query,
        mode: 'insensitive',
      },
    },
    take: 10,
    orderBy: { name: 'asc' },
  });
}

/** Fetch all tags for a subject for client-side autocomplete */
export async function getAllSubjectTags(subjectId: string) {
  const { workspaceId } = await getSession();
  return await prisma.tag.findMany({
    where: { subjectId, subject: { workspaceId } },
    orderBy: { name: 'asc' },
  });
}
