'use server';

import { prisma } from '@/lib/db';

export async function getKnowledgeData(workspaceId: string) {
  try {
    // 1. Fetch all NoteCategories for the workspace
    const categories = await prisma.noteCategory.findMany({
      where: { workspaceId },
      include: {
        captures: {
          include: {
            subject: true,
          }
        }
      }
    });

    // 2. Fetch all Tags for the workspace via Subjects
    const subjects = await prisma.subject.findMany({
      where: { workspaceId },
      include: {
        tags: {
          include: {
            topics: {
              include: {
                subject: true,
              }
            }
          }
        }
      }
    });

    const tags = subjects.flatMap(s => s.tags);

    // 3. Unify them
    const unifiedTagsMap = new Map<string, any>();

    const allTopics: any[] = [];
    const allNotes: any[] = [];

    // Process Topics & Tags
    for (const tag of tags) {
      const name = tag.name.toLowerCase().replace(/^#+/, '');
      if (!unifiedTagsMap.has(name)) {
        unifiedTagsMap.set(name, { id: name, name, count: 0, type: 'normal' });
      }
      const entry = unifiedTagsMap.get(name);
      entry.count += tag.topics.length;
      
      for (const topic of tag.topics) {
        allTopics.push({
          id: topic.id,
          title: topic.title,
          subject: topic.subject?.name || 'General',
          subjectColor: '#3b82f6',
          tags: [name] // We simplify tags for the UI component
        });
      }
    }

    // Process Captures & NoteCategories
    for (const cat of categories) {
      const name = cat.name.toLowerCase().replace(/^#+/, '');
      if (!unifiedTagsMap.has(name)) {
        unifiedTagsMap.set(name, { id: name, name, count: 0, type: 'normal', color: cat.color });
      } else if (cat.color && !unifiedTagsMap.get(name).color) {
        unifiedTagsMap.get(name).color = cat.color;
      }
      
      const entry = unifiedTagsMap.get(name);
      entry.count += cat.captures.length;
      
      for (const cap of cat.captures) {
        allNotes.push({
          id: cap.id,
          snippet: cap.content || cap.title || 'Untitled Note',
          subject: cap.subject?.name || 'General',
          subjectColor: '#3b82f6',
          tags: [name]
        });
      }
    }

    return {
      success: true,
      tags: Array.from(unifiedTagsMap.values())
        .filter(t => t.count > 0)
        .sort((a, b) => b.count - a.count),
      topics: allTopics,
      notes: allNotes
    };
  } catch (error: any) {
    console.error('Failed to get knowledge data:', error);
    return { error: 'Failed to load knowledge hub data' };
  }
}
