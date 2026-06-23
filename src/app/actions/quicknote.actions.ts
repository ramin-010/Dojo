'use server';

import { prisma } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { DEV_WORKSPACE_ID } from '@/lib/constants';
import { generateAIContent } from '@/lib/ai/orchestrator';
import { QUICK_NOTE_SYSTEM_PROMPT } from '@/lib/ai/prompts/quickNotePrompt';

export async function createQuickNote(data: {
  workspaceId?: string;
  subjectId?: string;
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

    // If topicId is provided but subjectId is missing, automatically infer subjectId
    let resolvedSubjectId = data.subjectId || null;
    if (data.topicId && !resolvedSubjectId) {
      const parentTopic = await prisma.topic.findUnique({ where: { id: data.topicId } });
      if (parentTopic) {
        resolvedSubjectId = parentTopic.subjectId;
      }
    }

    const newNote = await prisma.quickNote.create({
      data: {
        workspaceId: data.workspaceId || DEV_WORKSPACE_ID,
        subjectId: resolvedSubjectId,
        topicId: data.topicId || null,
        title: data.title || null,
        content: data.content,
        categoryId: categoryId,
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
  workspaceId?: string;
  subjectId?: string;
  topicId?: string;
  exactLevel?: 'dashboard' | 'subject' | 'topic';
}) {
  try {
    const whereClause: any = {};
    
    if (filters.workspaceId) whereClause.workspaceId = filters.workspaceId;
    
    if (filters.exactLevel === 'dashboard') {
      whereClause.subjectId = null;
      whereClause.topicId = null;
    } else if (filters.exactLevel === 'subject') {
      whereClause.subjectId = filters.subjectId;
      whereClause.topicId = null;
    } else if (filters.exactLevel === 'topic') {
      whereClause.topicId = filters.topicId;
    } else {
      // General filtering if exactLevel is not provided
      if (filters.subjectId) whereClause.subjectId = filters.subjectId;
      if (filters.topicId) whereClause.topicId = filters.topicId;
    }

    const notes = await prisma.quickNote.findMany({
      where: whereClause,
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

export async function generateQuickNoteAI(
  prompt: string,
  availableCategories: string[] = []
) {
  try {
    if (!prompt || prompt.trim() === '') {
      return { error: 'Prompt is required.' };
    }

    const categoriesContext = availableCategories.length > 0
      ? `AVAILABLE_CATEGORIES: ${availableCategories.join(', ')}`
      : 'AVAILABLE_CATEGORIES: none';

    const fullPrompt = `${categoriesContext}\n\nUser request: ${prompt.trim()}`;

    const { raw, provider } = await generateAIContent(fullPrompt, QUICK_NOTE_SYSTEM_PROMPT);

    let parsed;
    try {
      const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
      parsed = JSON.parse(cleaned);
    } catch (e) {
      console.error('Failed to parse JSON from AI:', raw);
      return { error: 'AI returned invalid format.' };
    }

    return {
      success: true,
      data: {
        title: parsed.title || prompt.slice(0, 30),
        content: parsed.content || prompt,
        category: parsed.category || null,
      },
      provider,
    };
  } catch (error: any) {
    console.error('AI Generation Error:', error);
    return { error: error.message || 'AI Generation failed' };
  }
}
