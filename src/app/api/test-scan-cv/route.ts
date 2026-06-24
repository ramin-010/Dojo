import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    
    // We expect the frontend to send 'file', 'output_mode', 'denoise_strength'
    // Forward the exact same formData to the Python microservice
    const pythonServiceUrl = 'http://127.0.0.1:8004/process';

    const res = await fetch(pythonServiceUrl, {
      method: 'POST',
      body: formData,
      // Do not set Content-Type header manually when sending FormData,
      // fetch will automatically set it with the correct boundary
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
    
    // Data contains: { url, timing_ms, stages }
    return NextResponse.json(data);

  } catch (error: any) {
    console.error('Error proxying to Python service:', error);
    return NextResponse.json(
      { error: 'Failed to connect to Python microservice. Is it running on port 8004?' }, 
      { status: 500 }
    );
  }
}
