import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const grayscale = formData.get('grayscale') === 'true';
    const normalize = formData.get('normalize') === 'true';
    const contrastMultiplier = parseFloat(formData.get('contrastMultiplier') as string) || 1.5;
    const brightnessOffset = parseInt(formData.get('brightnessOffset') as string) || -20;
    const sharpenSigma = parseFloat(formData.get('sharpenSigma') as string) || 1.5;
    const thresholdEnabled = formData.get('thresholdEnabled') === 'true';
    const thresholdLevel = parseInt(formData.get('thresholdLevel') as string) || 180;

    const buffer = Buffer.from(await file.arrayBuffer());

    let pipeline = sharp(buffer).rotate();

    if (grayscale) {
      pipeline = pipeline.grayscale();
    }

    if (normalize) {
      // Auto-contrast essentially
      pipeline = pipeline.normalize();
    }

    // Adjust contrast and brightness using linear(a, b)
    // Output = a * Input + b
    if (contrastMultiplier !== 1 || brightnessOffset !== 0) {
      pipeline = pipeline.linear(contrastMultiplier, brightnessOffset);
    }

    if (sharpenSigma > 0) {
      pipeline = pipeline.sharpen({ sigma: sharpenSigma, m1: 1, m2: 2, x1: 2, y2: 10, y3: 20 });
    }

    if (thresholdEnabled) {
      pipeline = pipeline.threshold(thresholdLevel);
    }

    const processedBuffer = await pipeline.toBuffer();
    
    // Return base64 for quick preview (it's just a test lab)
    const base64 = processedBuffer.toString('base64');
    const mimeType = file.type || 'image/jpeg';
    const dataUrl = `data:${mimeType};base64,${base64}`;

    return NextResponse.json({ url: dataUrl });
  } catch (error: any) {
    console.error('Error processing image:', error);
    return NextResponse.json({ error: error.message || 'Processing failed' }, { status: 500 });
  }
}
