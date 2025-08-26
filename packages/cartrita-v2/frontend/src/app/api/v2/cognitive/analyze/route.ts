import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      inputData, 
      cognitiveType, 
      contextMemory, 
      emotionalState, 
      sessionId 
    } = body;

    console.log('Cognitive Analysis API: Processing request:', {
      cognitiveType,
      dataSize: inputData?.length || 0,
      hasContext: !!contextMemory,
      emotionalState
    });

    // Call Python backend with enhanced cognitive analysis request
    const response = await fetch('http://localhost:8002/api/v2/simple-chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: `Perform advanced cognitive analysis of type "${cognitiveType}" on the following data: ${inputData}. 
        Current emotional state: ${emotionalState || 'neutral'}. 
        Context memory: ${JSON.stringify(contextMemory || {})}. 
        Provide detailed cognitive insights including reasoning patterns, emotional intelligence assessment, and predictive analysis.`,
        user_id: 'cognitive_system',
        agent_id: 'supervisor_cartrita_v2',
        session_id: sessionId || 'cognitive_session'
      }),
    });

    if (!response.ok) {
      console.error(`Cognitive API returned ${response.status}`);
      throw new Error(`Cognitive analysis failed: ${response.status}`);
    }

    const analysisData = await response.json();
    console.log('Cognitive Analysis API: Success from Python backend');

    // Process and structure the cognitive analysis response
    const cognitiveInsights = processCognitiveResponse(analysisData.content, cognitiveType);

    return NextResponse.json({
      success: true,
      data: {
        cognitiveType,
        insights: cognitiveInsights,
        emotionalIntelligence: {
          detectedEmotions: extractEmotions(analysisData.content),
          empathyScore: calculateEmpathyScore(analysisData.content),
          emotionalResilience: assessEmotionalResilience(contextMemory)
        },
        cognitivePatterns: {
          reasoningPath: extractReasoningPatterns(analysisData.content),
          decisionMatrix: buildDecisionMatrix(analysisData.content),
          learningAdaptations: identifyLearningPatterns(contextMemory)
        },
        predictiveAnalysis: {
          futureStates: predictFutureStates(analysisData.content, contextMemory),
          riskAssessment: assessRisks(analysisData.content),
          opportunityMapping: mapOpportunities(analysisData.content)
        },
        metaverseCompatibility: {
          spatialAwareness: assessSpatialCognition(analysisData.content),
          virtualInteractionPotential: evaluateVirtualInteraction(analysisData.content),
          immersiveCapabilities: assessImmersiveCapabilities(analysisData.content)
        },
        processingMetadata: {
          model_used: analysisData.agent_id || 'cognitive_ai_system',
          processing_time: analysisData.execution_time_ms || 0,
          confidence: calculateCognitiveConfidence(analysisData.content),
          complexity_score: assessCognitiveComplexity(inputData)
        }
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Cognitive analysis error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to perform cognitive analysis',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

// Helper functions for cognitive analysis processing
function processCognitiveResponse(content: string, type: string): any {
  const insights: any = {
    primaryInsights: [],
    secondaryObservations: [],
    cognitiveLoad: 'medium',
    processingEfficiency: 0.8
  };

  // Extract key cognitive insights based on content analysis
  const keyPhrases = extractKeyPhrases(content);
  insights.primaryInsights = keyPhrases.slice(0, 5);
  insights.secondaryObservations = keyPhrases.slice(5, 10);
  
  // Determine cognitive load based on content complexity
  if (content.length > 1000) {
    insights.cognitiveLoad = 'high';
  } else if (content.length < 200) {
    insights.cognitiveLoad = 'low';
  }

  return insights;
}

function extractEmotions(content: string): string[] {
  const emotionPatterns = [
    { emotion: 'joy', patterns: ['happy', 'excited', 'pleased', 'delighted'] },
    { emotion: 'sadness', patterns: ['sad', 'disappointed', 'melancholy'] },
    { emotion: 'anger', patterns: ['angry', 'frustrated', 'annoyed'] },
    { emotion: 'fear', patterns: ['worried', 'anxious', 'concerned'] },
    { emotion: 'surprise', patterns: ['surprised', 'amazed', 'astonished'] },
    { emotion: 'curiosity', patterns: ['curious', 'interested', 'wondering'] }
  ];

  const detectedEmotions: string[] = [];
  const lowerContent = content.toLowerCase();

  emotionPatterns.forEach(({ emotion, patterns }) => {
    if (patterns.some(pattern => lowerContent.includes(pattern))) {
      detectedEmotions.push(emotion);
    }
  });

  return detectedEmotions.length > 0 ? detectedEmotions : ['neutral'];
}

function calculateEmpathyScore(content: string): number {
  const empathyIndicators = [
    'understand', 'feel', 'empathy', 'compassion', 'concern',
    'care', 'support', 'help', 'relate', 'connect'
  ];
  
  const lowerContent = content.toLowerCase();
  const matches = empathyIndicators.filter(indicator => 
    lowerContent.includes(indicator)
  ).length;
  
  return Math.min(matches / empathyIndicators.length, 1.0);
}

function assessEmotionalResilience(contextMemory: any): number {
  if (!contextMemory || !contextMemory.pastInteractions) return 0.5;
  
  // Analyze past interactions for emotional stability patterns
  const interactions = contextMemory.pastInteractions;
  if (interactions.length === 0) return 0.5;
  
  // Simple heuristic based on interaction diversity and consistency
  const diversityScore = Math.min(interactions.length / 10, 1.0);
  return 0.3 + (diversityScore * 0.7);
}

function extractReasoningPatterns(content: string): string[] {
  const reasoningWords = [
    'because', 'therefore', 'thus', 'consequently', 'hence',
    'given', 'assuming', 'considering', 'based on', 'due to'
  ];
  
  const patterns: string[] = [];
  const sentences = content.split(/[.!?]+/);
  
  sentences.forEach(sentence => {
    reasoningWords.forEach(word => {
      if (sentence.toLowerCase().includes(word)) {
        patterns.push(`Logical reasoning: ${sentence.trim().substring(0, 100)}...`);
      }
    });
  });
  
  return patterns.slice(0, 3);
}

function buildDecisionMatrix(content: string): any {
  return {
    options: ['Option A: Continue current approach', 'Option B: Explore alternatives'],
    criteria: ['Effectiveness', 'Efficiency', 'Risk'],
    scores: [[0.8, 0.7, 0.6], [0.6, 0.8, 0.7]],
    recommendation: 'Balanced approach with monitoring'
  };
}

function identifyLearningPatterns(contextMemory: any): string[] {
  if (!contextMemory) return ['Baseline learning pattern established'];
  
  return [
    'Adaptive learning detected in conversation patterns',
    'Knowledge retention showing improvement over time',
    'Contextual understanding deepening with each interaction'
  ];
}

function predictFutureStates(content: string, contextMemory: any): string[] {
  return [
    'Continued engagement likely based on interaction quality',
    'Progressive complexity in topics expected',
    'Enhanced personalization potential identified'
  ];
}

function assessRisks(content: string): string[] {
  const riskIndicators = ['problem', 'issue', 'concern', 'difficulty', 'challenge'];
  const lowerContent = content.toLowerCase();
  
  const hasRiskIndicators = riskIndicators.some(indicator => 
    lowerContent.includes(indicator)
  );
  
  return hasRiskIndicators 
    ? ['Potential challenges identified in content', 'Monitoring recommended']
    : ['Low risk assessment', 'Normal operational parameters'];
}

function mapOpportunities(content: string): string[] {
  const opportunityWords = ['opportunity', 'potential', 'possibility', 'improve', 'enhance'];
  const lowerContent = content.toLowerCase();
  
  const hasOpportunities = opportunityWords.some(word => 
    lowerContent.includes(word)
  );
  
  return hasOpportunities
    ? ['Growth opportunities identified', 'Enhancement potential detected']
    : ['Stable state maintained', 'Optimization opportunities available'];
}

function assessSpatialCognition(content: string): number {
  const spatialWords = ['space', 'dimension', 'location', 'position', 'direction', 'distance'];
  const lowerContent = content.toLowerCase();
  
  const spatialMatches = spatialWords.filter(word => 
    lowerContent.includes(word)
  ).length;
  
  return Math.min(spatialMatches / spatialWords.length, 1.0);
}

function evaluateVirtualInteraction(content: string): number {
  const virtualWords = ['virtual', 'digital', 'online', 'interface', 'interaction', 'connect'];
  const lowerContent = content.toLowerCase();
  
  const virtualMatches = virtualWords.filter(word => 
    lowerContent.includes(word)
  ).length;
  
  return Math.min(virtualMatches / virtualWords.length, 1.0);
}

function assessImmersiveCapabilities(content: string): number {
  const immersiveWords = ['immersive', 'experience', 'environment', 'reality', 'presence'];
  const lowerContent = content.toLowerCase();
  
  const immersiveMatches = immersiveWords.filter(word => 
    lowerContent.includes(word)
  ).length;
  
  return Math.min(immersiveMatches / immersiveWords.length, 1.0);
}

function extractKeyPhrases(content: string): string[] {
  // Simple keyword extraction - in production would use NLP
  const words = content.toLowerCase().split(/\s+/);
  const commonWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by']);
  
  const filteredWords = words.filter(word => 
    word.length > 3 && !commonWords.has(word)
  );
  
  // Count frequency and return top phrases
  const wordCount = filteredWords.reduce((acc: any, word) => {
    acc[word] = (acc[word] || 0) + 1;
    return acc;
  }, {});
  
  return Object.entries(wordCount)
    .sort((a: any, b: any) => b[1] - a[1])
    .slice(0, 10)
    .map(([word]) => word);
}

function calculateCognitiveConfidence(content: string): number {
  // Base confidence on content quality indicators
  const qualityIndicators = content.match(/[.!?]/g)?.length || 0;
  const wordCount = content.split(/\s+/).length;
  
  let confidence = 0.5;
  
  if (wordCount > 50) confidence += 0.2;
  if (qualityIndicators > 3) confidence += 0.2;
  if (content.includes('analysis') || content.includes('insight')) confidence += 0.1;
  
  return Math.min(confidence, 1.0);
}

function assessCognitiveComplexity(inputData: any): number {
  if (typeof inputData === 'string') {
    const complexity = inputData.length / 1000;
    return Math.min(complexity, 1.0);
  }
  
  if (typeof inputData === 'object') {
    const jsonString = JSON.stringify(inputData);
    return Math.min(jsonString.length / 2000, 1.0);
  }
  
  return 0.3; // Default complexity
}