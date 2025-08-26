import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const sessionId = formData.get('session_id') as string || 'vision_session';

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      );
    }

    // Create uploads directory if it doesn't exist
    const uploadsDir = join(process.cwd(), 'uploads');
    if (!existsSync(uploadsDir)) {
      await mkdir(uploadsDir, { recursive: true });
    }

    // Create unique filename
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const fileName = `${Date.now()}-${file.name}`;
    const filePath = join(uploadsDir, fileName);

    // Write file to disk
    await writeFile(filePath, buffer);

    console.log('Vision Upload: File saved:', fileName);

    return NextResponse.json({
      success: true,
      data: {
        filename: fileName,
        originalName: file.name,
        size: file.size,
        type: file.type,
        path: filePath,
        sessionId: sessionId
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Vision upload error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to upload file',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}