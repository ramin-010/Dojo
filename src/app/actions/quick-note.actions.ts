'use server';
import { prisma } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { triggerQuickNoteSync } from '@/lib/pusher';
import { v2 as cloudinary } from 'cloudinary';

// Configure cloudinary for the server action
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

type AttachmentInput = {
  url: string;
  publicId: string;
  fileName: string;
  fileType: string;
};

export async function getQuickNotes(workspaceId: string) {
  const notes = await prisma.quickNote.findMany({
    where: { workspaceId },
    orderBy: { createdAt: 'asc' },
  });
  return notes;
}

export async function upsertQuickNote(
  id: string,
  content: string,
  workspaceId: string,
  attachments?: AttachmentInput[] | null
) {
  // Never save or sync empty notes
  if (content.trim() === '' && (!attachments || attachments.length === 0)) return null;

  const updateData: Record<string, unknown> = { content };
  const createData: Record<string, unknown> = { id, content, workspaceId };

  if (attachments && attachments.length > 0) {
    updateData.attachments = attachments;
    createData.attachments = attachments;
  }

  const note = await prisma.quickNote.upsert({
    where: { id },
    update: updateData,
    create: createData as any,
  });

  // Determine event type based on whether record existed
  const isNew = note.createdAt.getTime() === note.updatedAt.getTime();
  await triggerQuickNoteSync(
    workspaceId,
    isNew ? 'note:created' : 'note:updated',
    {
      id: note.id,
      content: note.content,
      createdAt: note.createdAt.toISOString(),
      workspaceId: note.workspaceId,
      attachments: note.attachments,
    }
  );

  revalidatePath('/dashboard');
  return note;
}

export async function createQuickNoteWithAttachments(
  id: string,
  workspaceId: string,
  content: string,
  attachments: AttachmentInput[]
) {
  const note = await prisma.quickNote.upsert({
    where: { id },
    create: {
      id,
      workspaceId,
      content,
      attachments,
    },
    update: {
      content,
      attachments,
    }
  });

  await triggerQuickNoteSync(workspaceId, 'note:created', {
    id: note.id,
    content: note.content,
    createdAt: note.createdAt.toISOString(),
    workspaceId: note.workspaceId,
    attachments: note.attachments,
  });

  revalidatePath('/dashboard');
  return note;
}

export async function deleteQuickNote(id: string) {
  const note = await prisma.quickNote.findUnique({ where: { id } });
  if (note) {
    // Delete attachments from Cloudinary if they exist
    if (note.attachments && Array.isArray(note.attachments)) {
      for (const attachment of note.attachments as any[]) {
        if (attachment.publicId) {
          try {
            // Delete as image (most common)
            await cloudinary.uploader.destroy(attachment.publicId, { invalidate: true, resource_type: 'image' });
            // Also attempt to delete as raw in case it's a non-image file (.pdf, .md, etc)
            await cloudinary.uploader.destroy(attachment.publicId, { invalidate: true, resource_type: 'raw' });
          } catch (e) {
            console.error(`Failed to delete Cloudinary attachment ${attachment.publicId}:`, e);
          }
        }
      }
    }

    await prisma.quickNote.delete({ where: { id } });
    await triggerQuickNoteSync(note.workspaceId, 'note:deleted', { id });
  }
  revalidatePath('/dashboard');
}
