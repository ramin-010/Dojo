'use server';

import { prisma } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { DEV_WORKSPACE_ID } from '@/lib/constants';

export async function createQuickNote(data: {
  subjectId: string;
  topicId?: string;
  content: string;
  title?: string;
  categoryName?: string;
}) {
  try {
    let categoryId = null;

    if (data.categoryName) {
      // Upsert the category at the workspace level
      const category = await prisma.noteCategory.upsert({
        where: {
          workspaceId_name: {
            workspaceId: DEV_WORKSPACE_ID,
            name: data.categoryName,
          },
        },
        update: {},
        create: {
          workspaceId: DEV_WORKSPACE_ID,
          name: data.categoryName,
        },
      });
      categoryId = category.id;
    }

    const newNote = await prisma.quickNote.create({
      data: {
        subjectId: data.subjectId,
        topicId: data.topicId || null,
        title: data.title || null,
        content: data.content,
        categoryId: categoryId,
        isSubjectLevel: !data.topicId,
      },
      include: {
        category: true,
      },
    });

    if (data.topicId) {
      revalidatePath(`/topic/${data.topicId}`);
    }

    return { success: true, note: newNote };
  } catch (error: any) {
    console.error('Failed to create quick note:', error);
    return { error: error.message || 'Failed to create quick note' };
  }
}

export async function getQuickNotes(filters: {
  subjectId?: string;
  topicId?: string;
}) {
  try {
    const notes = await prisma.quickNote.findMany({
      where: {
        ...(filters.subjectId ? { subjectId: filters.subjectId } : {}),
        ...(filters.topicId ? { topicId: filters.topicId } : {}),
      },
      include: {
        category: true,
      },
      orderBy: [
        { isPinned: 'desc' },
        { createdAt: 'desc' }
      ],
    });

    return { success: true, notes };
  } catch (error: any) {
    console.error('Failed to get quick notes:', error);
    return { error: 'Failed to fetch quick notes' };
  }
}

export async function togglePinQuickNote(id: string, isPinned: boolean) {
  try {
    const note = await prisma.quickNote.update({
      where: { id },
      data: { isPinned },
    });
    
    if (note.topicId) {
      revalidatePath(`/topic/${note.topicId}`);
    }

    return { success: true, note };
  } catch (error: any) {
    return { error: 'Failed to update note' };
  }
}

export async function deleteQuickNote(id: string) {
  try {
    const note = await prisma.quickNote.delete({
      where: { id },
    });
    
    if (note.topicId) {
      revalidatePath(`/topic/${note.topicId}`);
    }

    return { success: true };
  } catch (error: any) {
    return { error: 'Failed to delete note' };
  }
}

export async function getWorkspaceNoteCategories() {
  try {
    const categories = await prisma.noteCategory.findMany({
      where: {
        workspaceId: DEV_WORKSPACE_ID,
      },
      orderBy: {
        name: 'asc',
      },
    });
    
    return { success: true, categories };
  } catch (error: any) {
    return { error: 'Failed to fetch note categories' };
  }
}
