import { NextRequest, NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';
import { prisma } from '@/lib/db';
import { DEV_WORKSPACE_ID } from '@/lib/constants';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const topicId = formData.get('topicId') as string | null;
    let subjectId = formData.get('subjectId') as string | null;
    const file = formData.get('file') as File | null;
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Forward the exact same formData to the Python microservice
    const pythonServiceUrl = 'http://127.0.0.1:8004/process';

    const res = await fetch(pythonServiceUrl, {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error('Python service error:', errorText);
      return NextResponse.json(
        { error: `Python service failed: ${res.status} ${res.statusText}` }, 
        { status: res.status }
      );
    }

    const data = await res.json();
    const base64Data = data.url; // This is the massive data:image/jpeg;base64 string
    
    // 2. Upload Base64 to Cloudinary
    const uploadResult = await cloudinary.uploader.upload(base64Data, {
      folder: 'revise-uploads',
    });

    const cloudUrl = uploadResult.secure_url;
    const cloudPublicId = uploadResult.public_id;

    // 3. Save to Database (Capture)
    let createdResource = null;
    if (topicId) {
      if (!subjectId) {
        const topic = await prisma.topic.findUnique({ where: { id: topicId } });
        if (topic) subjectId = topic.subjectId;
      }
      
      if (subjectId) {
        createdResource = await prisma.capture.create({
          data: {
            workspaceId: DEV_WORKSPACE_ID,
            subjectId,
            topicId,
            type: 'LINK',
            url: cloudUrl,
            title: `clean_${file.name}`,
            cloudPublicId: cloudPublicId,
            fileType: 'image/jpeg'
          }
        });
      }
    }

    return NextResponse.json({
      url: cloudUrl,
      publicId: cloudPublicId,
      resource: createdResource,
      timing_ms: data.timing_ms,
      stages: data.stages
    });

  } catch (error: any) {
    console.error('Error proxying to Python service or Cloudinary:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to connect to Python microservice or Cloudinary' }, 
      { status: 500 }
    );
  }
}
