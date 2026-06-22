import type { NextApiRequest, NextApiResponse } from 'next';
import { upflyUpload } from 'upfly';
import { prisma } from '@/lib/db';

export const config = {
  api: {
    bodyParser: false, // Disallow body parsing, consume as stream for multer/upfly
  },
};

const cloud_name = process.env.CLOUDINARY_CLOUD_NAME || '';
const cloud_key = process.env.CLOUDINARY_API_KEY || '';
const cloud_secret = process.env.CLOUDINARY_API_SECRET || '';

const upload = upflyUpload({
  fields: {
    "file": {
      output: 'memory',
      cloudStorage: true,
      cloudProvider: "cloudinary",
      cloudConfig: {
        cloud_name: cloud_name,
        api_key: cloud_key,
        api_secret: cloud_secret,
        folder: 'revise-uploads'
      }
    },
  },
});

function runMiddleware(
  req: NextApiRequest,
  res: NextApiResponse,
  fn: Function
) {
  return new Promise((resolve, reject) => {
    fn(req, res, (result: any) => {
      if (result instanceof Error) {
        return reject(result);
      }
      return resolve(result);
    });
  });
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    await runMiddleware(req, res, upload);
    
    const files = (req as any).files as Record<string, any[]>;
    const uploadedFiles = files?.['file'];
    
    const imageId = req.body.imageId;
    const topicId = req.body.topicId;
    let subjectId = req.body.subjectId;
    
    if (!uploadedFiles || uploadedFiles.length === 0) {
        return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const uploadedFile = uploadedFiles[0];
    const { cloudUrl, cloudPublicId, cloudProvider, originalname, mimetype } = uploadedFile;

    if (!cloudUrl) {
        return res.status(500).json({ error: 'Upload provider failed to return URL' });
    }

    // Save to Database (ResourceLink)
    let createdResource = null;
    if (topicId) {
      if (!subjectId) {
        // Resolve subjectId from topic
        const topic = await prisma.topic.findUnique({ where: { id: topicId } });
        if (topic) subjectId = topic.subjectId;
      }
      
      if (subjectId) {
        const isImage = mimetype?.startsWith('image/');
        createdResource = await prisma.resourceLink.create({
          data: {
            subjectId,
            topicId,
            isSubjectLevel: false,
            url: cloudUrl,
            title: originalname || 'Uploaded File',
            category: isImage ? 'image' : 'file',
            cloudPublicId: cloudPublicId,
            fileType: mimetype
          }
        });
      }
    }

    return res.status(200).json({ 
        url: cloudUrl,
        publicId: cloudPublicId,
        provider: cloudProvider,
        imageId: imageId,
        fileName: originalname,
        fileType: mimetype,
        resource: createdResource
    });
  } catch (error: any) {
    console.error('[API/Upload] Upload error:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}
