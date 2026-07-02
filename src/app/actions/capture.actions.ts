'use server';

import { prisma } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { DEV_WORKSPACE_ID } from '@/lib/constants';
import { generateAIContent } from '@/lib/ai/orchestrator';
import { QUICK_NOTE_SYSTEM_PROMPT } from '@/lib/ai/prompts/quickNotePrompt';
import { startCaptureRevisions } from './revision.actions';
import { CaptureType } from '@prisma/client';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';

// Configure cloudinary for the server action
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

async function uploadFileToCloudinary(file: File): Promise<UploadApiResponse> {
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload_stream(
      { folder: 'revise-uploads', resource_type: 'auto' },
      (error, result) => {
        if (error) reject(error);
        else if (result) resolve(result);
        else reject(new Error('Unknown upload error'));
      }
    ).end(buffer);
  });
}

export async function createCaptureWithFiles(formData: FormData) {
  try {
    const dataString = formData.get('data') as string;
    const data = JSON.parse(dataString);
    if (data.explicitDate) {
      data.explicitDate = new Date(data.explicitDate);
    }
    const files = formData.getAll('files') as File[];

    const uploadedFiles = [];
    if (files && files.length > 0) {
      for (const file of files) {
        const result = await uploadFileToCloudinary(file);
        uploadedFiles.push({
          url: result.secure_url,
          cloudPublicId: result.public_id,
          fileType: file.type,
          fileName: file.name
        });
      }
    }

    data.attachments = uploadedFiles;
    return await createCapture(data);
  } catch (error: any) {
    console.error('Error in createCaptureWithFiles:', error);
    throw new Error('Failed to upload files and create capture');
  }
}

export async function createCapture(data: {
  workspaceId?: string;
  subjectId?: string;
  topicId?: string;
  content?: string;
  title?: string;
  url?: string;
  categoryName?: string;
  isPinned?: boolean;
  addToSchedule?: boolean;
  reminder?: string;
  explicitDate?: Date; // To pass explicit date from native date picker
  explicitType?: 'note' | 'task' | 'link';
  cloudPublicId?: string;
  fileType?: string;
  attachments?: { url: string; cloudPublicId: string; fileType?: string; fileName?: string }[];
}) {
  try {
    let categoryId = null;

    if (data.categoryName) {
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

    let resolvedSubjectId = data.subjectId || null;
    if (data.topicId && !resolvedSubjectId) {
      const parentTopic = await prisma.topic.findUnique({ where: { id: data.topicId } });
      if (parentTopic) {
        resolvedSubjectId = parentTopic.subjectId;
      }
    }

    const urlRegex = /^(https?:\/\/[^\s]+)$/;
    const textToCheck = (data.title?.trim() || data.content?.trim() || '');
    const isUrl = urlRegex.test(textToCheck);
    const typeLower = data.explicitType || (isUrl ? 'link' : 'note');
    const typeEnum = typeLower.toUpperCase() as CaptureType;

    const dueDate = data.explicitDate || (data.reminder === 'tomorrow' ? new Date(Date.now() + 86400000) : null);

    const savedItem = await prisma.capture.create({
      data: {
        workspaceId: data.workspaceId || DEV_WORKSPACE_ID,
        subjectId: resolvedSubjectId,
        topicId: data.topicId || null,
        type: typeEnum,
        title: data.title || (typeEnum !== 'NOTE' ? textToCheck : null),
        content: data.content || null,
        url: data.url || (typeEnum === 'LINK' && isUrl ? textToCheck : null),
        cloudPublicId: data.cloudPublicId || null,
        fileType: data.fileType || null,
        categoryId: categoryId,
        isPinned: data.isPinned || false,
        dueDate: typeEnum === 'TASK' ? dueDate : null, // Store dueDate on TASK captures directly
        attachments: data.attachments && data.attachments.length > 0 ? {
          create: data.attachments.map(a => ({
            url: a.url,
            cloudPublicId: a.cloudPublicId,
            fileType: a.fileType || null,
            fileName: a.fileName || null,
          }))
        } : undefined,
      },
      include: {
        category: true,
        attachments: true,
      },
    });

    // If it's NOT a task but it has a date, we create a Reminder
    if (typeEnum !== 'TASK' && dueDate) {
      await prisma.reminder.create({
        data: {
          captureId: savedItem.id,
          remindAt: dueDate,
        }
      });
    }

    if (data.addToSchedule) {
      await startCaptureRevisions(savedItem.id);
    }

    if (data.topicId) {
      revalidatePath(`/topic/${data.topicId}`);
    }
    if (resolvedSubjectId) {
      revalidatePath(`/subject/${resolvedSubjectId}`);
    }
    revalidatePath('/');
    revalidatePath('/dashboard');

    return { success: true, item: savedItem, isUrl };
  } catch (error: any) {
    console.error('Failed to create capture:', error);
    return { error: error.message || 'Failed to capture' };
  }
}

export async function getCaptures(filters: {
  workspaceId?: string;
  subjectId?: string;
  topicId?: string;
  type?: 'NOTE' | 'TASK' | 'LINK';
  exactLevel?: 'dashboard' | 'subject' | 'topic';
}) {
  try {
    const whereClause: any = {};
    
    if (filters.workspaceId) whereClause.workspaceId = filters.workspaceId;
    if (filters.type) whereClause.type = filters.type;
    
    if (filters.exactLevel === 'dashboard') {
      whereClause.subjectId = null;
      whereClause.topicId = null;
    } else if (filters.exactLevel === 'subject') {
      whereClause.subjectId = filters.subjectId;
      whereClause.topicId = null;
    } else if (filters.exactLevel === 'topic') {
      whereClause.topicId = filters.topicId;
    } else {
      if (filters.subjectId) whereClause.subjectId = filters.subjectId;
      if (filters.topicId) whereClause.topicId = filters.topicId;
    }

    const captures = await prisma.capture.findMany({
      where: whereClause,
      include: {
        category: true,
        reminder: true,
      },
      orderBy: [
        { isPinned: 'desc' },
        { createdAt: 'desc' }
      ],
    });

    return { success: true, captures };
  } catch (error: any) {
    console.error('Failed to get captures:', error);
    return { error: 'Failed to fetch captures' };
  }
}

export async function togglePinCapture(id: string, isPinned: boolean) {
  try {
    const item = await prisma.capture.update({
      where: { id },
      data: { isPinned },
    });
    
    if (item.topicId) {
      revalidatePath(`/topic/${item.topicId}`);
    }

    return { success: true, item };
  } catch (error: any) {
    return { error: 'Failed to update item' };
  }
}

export async function toggleTaskStatus(id: string, isDone: boolean) {
  try {
    const item = await prisma.capture.update({
      where: { id },
      data: { isDone },
    });
    
    if (item.topicId) {
      revalidatePath(`/topic/${item.topicId}`);
    }
    revalidatePath('/');
    revalidatePath('/dashboard');

    return { success: true, item };
  } catch (error: any) {
    return { error: 'Failed to update task' };
  }
}

export async function toggleReminder(id: string, isDismissed: boolean) {
  try {
    const item = await prisma.reminder.update({
      where: { id },
      data: { isDismissed },
    });
    
    revalidatePath('/');
    revalidatePath('/dashboard');

    return { success: true, item };
  } catch (error: any) {
    return { error: 'Failed to update reminder' };
  }
}

export async function rescheduleReminder(id: string, remindAt: Date) {
  try {
    const item = await prisma.reminder.update({
      where: { id },
      data: { remindAt },
    });
    
    revalidatePath('/');
    revalidatePath('/dashboard');

    return { success: true, item };
  } catch (error: any) {
    return { error: 'Failed to reschedule reminder' };
  }
}

export async function updateCapture(id: string, data: { dueDate?: Date | null }) {
  try {
    const item = await prisma.capture.update({
      where: { id },
      data,
    });
    revalidatePath('/');
    revalidatePath('/dashboard');
    return { success: true, item };
  } catch (error: any) {
    return { error: 'Failed to update capture' };
  }
}

export async function deleteCapture(id: string) {
  try {
    const item = await prisma.capture.delete({
      where: { id },
    });
    
    if (item.topicId) {
      revalidatePath(`/topic/${item.topicId}`);
    }
    revalidatePath('/');
    revalidatePath('/dashboard');

    return { success: true };
  } catch (error: any) {
    return { error: 'Failed to delete item' };
  }
}

export async function renameCapture(id: string, title: string) {
  try {
    const item = await prisma.capture.update({
      where: { id },
      data: { title },
    });
    revalidatePath('/');
    revalidatePath('/dashboard');
    return { success: true, item };
  } catch (error: any) {
    return { error: 'Failed to rename capture' };
  }
}

export async function createTextCaptureLink(topicId: string, text: string, type: 'url' | 'other' = 'other') {
  try {
    const isUrl = type === 'url' || text.startsWith('http');
    const captureType = isUrl ? 'LINK' : 'NOTE';
    
    const item = await prisma.capture.create({
      data: {
        workspaceId: DEV_WORKSPACE_ID,
        topicId,
        type: captureType,
        title: isUrl ? text : null,
        url: isUrl ? text : null,
        content: isUrl ? null : text,
      }
    });
    revalidatePath('/');
    revalidatePath('/dashboard');
    return { success: true, type: isUrl ? 'resource' : 'note', data: item };
  } catch (error: any) {
    return { error: 'Failed to create text capture' };
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

export async function generateCaptureAI(
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
