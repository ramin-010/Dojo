'use server';
import { prisma } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { triggerQuickNoteSync } from '@/lib/pusher';
import { v2 as cloudinary } from 'cloudinary';
import { getSession } from '@/lib/auth';

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

/**
 * Server actions are public HTTP endpoints: any argument is attacker
 * controlled. workspaceId is therefore always derived from the session and
 * never accepted as a parameter, and every query is scoped by it.
 *
 * `id` arguments still need an explicit ownership check, because a bare
 * `where: { id }` would happily read or mutate another workspace's row.
 */
async function assertNoteInWorkspace(id: string, workspaceId: string) {
  const existing = await prisma.quickNote.findUnique({
    where: { id },
    select: { id: true, workspaceId: true },
  });
  if (existing && existing.workspaceId !== workspaceId) {
    throw new Error('Not found');
  }
  return existing;
}

export async function getQuickNotes() {
  const { workspaceId } = await getSession();
  const notes = await prisma.quickNote.findMany({
    where: { workspaceId },
    orderBy: { createdAt: 'asc' },
  });
  return notes;
}

export async function upsertQuickNote(
  id: string,
  content: string,
  attachments?: AttachmentInput[] | null,
  category: 'PRIMARY' | 'TEMPORARY' = 'PRIMARY'
) {
  const { workspaceId } = await getSession();

  // Never save or sync empty notes
  if (content.trim() === '' && (!attachments || attachments.length === 0)) return null;

  // Upserting on `id` alone would let a caller overwrite a note in another
  // workspace by guessing its id.
  await assertNoteInWorkspace(id, workspaceId);

  const updateData: Record<string, unknown> = { content, category };
  const createData: Record<string, unknown> = { id, content, workspaceId, category };

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
      category: note.category,
    }
  );

  revalidatePath('/dashboard');
  return note;
}

export async function createQuickNoteWithAttachments(
  id: string,
  content: string,
  attachments: AttachmentInput[],
  category: 'PRIMARY' | 'TEMPORARY' = 'PRIMARY'
) {
  const { workspaceId } = await getSession();
  await assertNoteInWorkspace(id, workspaceId);

  const note = await prisma.quickNote.upsert({
    where: { id },
    create: {
      id,
      workspaceId,
      content,
      attachments,
      category,
    },
    update: {
      content,
      attachments,
      category,
    }
  });

  await triggerQuickNoteSync(workspaceId, 'note:created', {
    id: note.id,
    content: note.content,
    createdAt: note.createdAt.toISOString(),
    workspaceId: note.workspaceId,
    attachments: note.attachments,
    category: note.category,
  });

  revalidatePath('/dashboard');
  return note;
}

export async function deleteQuickNote(id: string) {
  const { workspaceId } = await getSession();
  const note = await prisma.quickNote.findFirst({ where: { id, workspaceId } });
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

export async function toggleQuickNotePin(id: string) {
  const { workspaceId } = await getSession();
  const note = await prisma.quickNote.findFirst({ where: { id, workspaceId } });
  if (!note) return null;

  const updated = await prisma.quickNote.update({
    where: { id },
    data: { isPinned: !note.isPinned },
  });

  await triggerQuickNoteSync(updated.workspaceId, 'note:updated', {
    id: updated.id,
    content: updated.content,
    createdAt: updated.createdAt.toISOString(),
    workspaceId: updated.workspaceId,
    attachments: updated.attachments,
    isPinned: updated.isPinned,
  });

  revalidatePath('/dashboard');
  return updated;
}
