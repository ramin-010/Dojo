import { NextRequest, NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';
import { prisma } from '@/lib/db';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function POST(request: NextRequest) {
  try {
    const { publicIds } = await request.json();
    
    if (!publicIds || !Array.isArray(publicIds)) {
      return NextResponse.json({ error: 'Missing or invalid publicIds array' }, { status: 400 });
    }

    // 1. Delete from Cloudinary
    await Promise.all(publicIds.map(id => cloudinary.uploader.destroy(id)));

    // 2. Delete from Database
    await prisma.resourceLink.deleteMany({
      where: {
        cloudPublicId: { in: publicIds }
      }
    });

    return NextResponse.json({ success: true, deleted: publicIds.length });

  } catch (error: any) {
    console.error('Error deleting Cloudinary assets:', error);
    return NextResponse.json({ error: 'Failed to delete assets' }, { status: 500 });
  }
}
