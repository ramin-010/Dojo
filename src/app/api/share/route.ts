import { NextResponse } from 'next/server';
import { getSessionSafe } from '@/lib/auth';
import { v2 as cloudinary } from 'cloudinary';
import { v4 as uuidv4 } from 'uuid';
import { createQuickNoteWithAttachments, upsertQuickNote } from '@/app/actions/quick-note.actions';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function POST(request: Request) {
  try {
    const session = await getSessionSafe();
    
    if (!session) {
      // Redirect to login if unauthenticated
      return NextResponse.redirect(new URL('/login', request.url), 303);
    }

    const formData = await request.formData();
    
    const title = formData.get('title') as string | null;
    const text = formData.get('text') as string | null;
    const url = formData.get('url') as string | null;
    const files = formData.getAll('media') as File[];

    let content = '';
    if (title) content += `${title}\n\n`;
    if (text) content += `${text}\n\n`;
    if (url) content += `${url}`;
    content = content.trim();

    const attachments: any[] = [];
    
    if (files && files.length > 0) {
      for (const file of files) {
        if (!(file instanceof Blob) || file.size === 0) continue;
        
        const buffer = Buffer.from(await file.arrayBuffer());
        
        const uploadResult = await new Promise<any>((resolve, reject) => {
          cloudinary.uploader.upload_stream(
            { folder: 'revise_quick_notes', resource_type: 'auto' },
            (error, result) => {
              if (error) reject(error);
              else resolve(result);
            }
          ).end(buffer);
        });

        attachments.push({
          url: uploadResult.secure_url,
          publicId: uploadResult.public_id,
          fileName: file.name || 'shared_file',
          fileType: file.type || uploadResult.resource_type,
        });
      }
    }

    const noteId = uuidv4();
    
    if (content || attachments.length > 0) {
      if (attachments.length > 0) {
        await createQuickNoteWithAttachments(noteId, content, attachments, 'PRIMARY');
      } else {
        await upsertQuickNote(noteId, content, undefined, 'PRIMARY');
      }
    }

    // Redirect back to dashboard where they can see the newly created note
    // Use 303 to ensure the browser does a GET request for the redirect destination
    return NextResponse.redirect(new URL('/dashboard', request.url), 303);
    
  } catch (error) {
    console.error('Share Target Error:', error);
    // Even if it fails, send them back to the app instead of showing a raw error page
    return NextResponse.redirect(new URL('/dashboard?error=share_failed', request.url), 303);
  }
}
