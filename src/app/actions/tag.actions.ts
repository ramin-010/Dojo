'use server';

import { prisma } from '@/lib/db';

/** Search tags for autocomplete within a subject */
export async function searchTags(subjectId: string, query: string) {
  if (!query.trim()) return [];
  return await prisma.tag.findMany({
    where: {
      subjectId,
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
  return await prisma.tag.findMany({
    where: { subjectId },
    orderBy: { name: 'asc' },
  });
}
