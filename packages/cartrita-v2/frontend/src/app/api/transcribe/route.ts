import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

// Initialize OpenAI client only if API key is available
const getOpenAIClient = () => {
  if (!process.env.OPENAI_API_KEY) {
    return null;
  }
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
};

export async function POST(request: NextRequest) {
  try {
    // Check if API key is configured
    const openai = getOpenAIClient();
    if (!openai) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      );
    }

    // Parse the form data
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const model = formData.get('model') as string || 'whisper-1';
    const language = formData.get('language') as string || 'en';
    const responseFormat = formData.get('response_format') as string || 'json';

    if (!file) {
      return NextResponse.json(
        { error: 'Audio file is required' },
        { status: 400 }
      );
    }

    // Validate file size (OpenAI Whisper has a 25MB limit)
    const maxFileSize = 25 * 1024 * 1024; // 25MB
    if (file.size > maxFileSize) {
      return NextResponse.json(
        { error: 'File size exceeds 25MB limit' },
        { status: 400 }
      );
    }

    // Validate file type
    const allowedTypes = [
      'audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/m4a',
      'audio/wav', 'audio/webm', 'video/mp4', 'video/mpeg'
    ];
    
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: `Unsupported file type: ${file.type}` },
        { status: 400 }
      );
    }

    // Convert File to format compatible with OpenAI API
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    
    // Create a file-like object that OpenAI SDK expects
    const audioFile = new File([uint8Array], file.name, { type: file.type });

    // Call OpenAI Whisper API
    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: model,
      language: language,
      response_format: responseFormat as 'json' | 'text' | 'srt' | 'verbose_json' | 'vtt',
      // Optional parameters that can be added:
      // temperature: 0, // More deterministic results
      // prompt: '', // Context to guide the transcription
    });

    // Return the transcription result
    if (responseFormat === 'json' || responseFormat === 'verbose_json') {
      return NextResponse.json({
        text: transcription.text,
        ...(responseFormat === 'verbose_json' && {
          language: (transcription as any).language,
          duration: (transcription as any).duration,
          segments: (transcription as any).segments,
        })
      });
    } else {
      // For text, srt, vtt formats, return as text
      return new NextResponse(transcription as string, {
        headers: {
          'Content-Type': responseFormat === 'srt' ? 'text/srt' : 
                          responseFormat === 'vtt' ? 'text/vtt' : 'text/plain',
        },
      });
    }

  } catch (error) {
    console.error('Transcription error:', error);
    
    // Handle OpenAI API errors
    if (error instanceof Error) {
      if (error.message.includes('insufficient_quota')) {
        return NextResponse.json(
          { error: 'OpenAI API quota exceeded' },
          { status: 429 }
        );
      }
      
      if (error.message.includes('invalid_request_error')) {
        return NextResponse.json(
          { error: 'Invalid request to OpenAI API' },
          { status: 400 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Internal server error during transcription' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed. Use POST to transcribe audio.' },
    { status: 405 }
  );
}