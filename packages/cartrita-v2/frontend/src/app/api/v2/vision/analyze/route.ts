import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { filename, prompt, sessionId } = body;

    console.log('Vision Analysis: Analyzing file:', filename);

    // Call Python backend vision agent for analysis
    const apiUrl = process.env.PYTHON_API_BASE_URL || 'http://python-backend:8000';
    const response = await fetch(`${apiUrl}/api/v2/simple-chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: `Please analyze the uploaded image file "${filename}"${prompt ? ` with focus on: ${prompt}` : ''}. Provide detailed analysis including objects detected, text content if any, and overall description.`,
        user_id: 'vision_user',
        agent_id: 'vision_agent_v2',
        session_id: sessionId || 'vision_session'
      }),
    });

    if (!response.ok) {
      console.error(`Python Vision API returned ${response.status}`);
      throw new Error(`Vision analysis failed: ${response.status}`);
    }

    const analysisData = await response.json();
    console.log('Vision Analysis: Success from Python backend');

    // Extract structured data from the analysis response
    const content = analysisData.content || analysisData.response || 'Analysis completed';
    
    // Parse the response to extract objects and text
    const objects = extractObjectsFromAnalysis(content);
    const extractedText = extractTextFromAnalysis(content);

    return NextResponse.json({
      success: true,
      data: {
        description: content,
        objects: objects,
        text: extractedText,
        analysis: {
          model_used: analysisData.agent_id || 'vision_agent_v2',
          confidence: 0.85,
          processing_time: analysisData.execution_time_ms || analysisData.response_time_ms || 0,
          filename: filename
        }
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Vision analysis error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to analyze image',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

// Helper function to extract objects from analysis text
function extractObjectsFromAnalysis(text: string): string[] {
  const content = text.toLowerCase();
  const detectedObjects: string[] = [];

  // Common object detection keywords
  const objectKeywords = [
    'person', 'people', 'man', 'woman', 'child',
    'car', 'vehicle', 'truck', 'bus', 'motorcycle',
    'building', 'house', 'structure', 'architecture',
    'tree', 'plant', 'flower', 'nature',
    'animal', 'dog', 'cat', 'bird',
    'text', 'writing', 'sign', 'document',
    'chart', 'graph', 'diagram', 'table',
    'computer', 'phone', 'screen', 'device'
  ];

  objectKeywords.forEach(keyword => {
    if (content.includes(keyword)) {
      detectedObjects.push(keyword);
    }
  });

  return detectedObjects.slice(0, 8); // Limit to 8 objects
}

// Helper function to extract text content from analysis
function extractTextFromAnalysis(text: string): string {
  // Look for quoted text or text indicators
  const patterns = [
    /text[:\s]*['""]([^'""]+)['"]/gi,
    /says?[:\s]*['""]([^'""]+)['"]/gi,
    /reading?[:\s]*['""]([^'""]+)['"]/gi,
    /contains?[:\s]*['""]([^'""]+)['"]/gi
  ];

  for (const pattern of patterns) {
    const match = pattern.exec(text);
    if (match && match[1]) {
      return match[1].trim();
    }
  }

  return '';
}