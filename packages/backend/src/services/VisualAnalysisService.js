const EventEmitter = require('events');
const OpenAI = require('openai');

class VisualAnalysisService extends EventEmitter {
  constructor() {
    super();
    this.openai = null;
    this.isAnalyzing = false;
    this.currentUserId = null;
    this.visualContext = {
      currentScene: null,
      detectedObjects: [],
      people: [],
      activities: [],
      lighting: 'unknown',
      environment: 'unknown',
      mood: 'neutral'
    };
    
    this.analysisSettings = {
      detectionSensitivity: 0.7,
      faceDetection: true,
      objectDetection: true,
      sceneAnalysis: true,
      emotionDetection: true,
      activityRecognition: true,
      privacyMode: false
    };

    this.analysisHistory = [];
    this.faceTrackingEnabled = true;
    this.initializeService();
  }

  initializeService() {
    if (!process.env.OPENAI_API_KEY) {
      console.error('[VisualAnalysisService] OpenAI API key not configured');
      return;
    }

    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });

    console.log('[VisualAnalysisService] Service initialized');
  }

  async startVisualAnalysis(userId, settings = {}) {
    try {
      if (this.isAnalyzing) {
        console.warn('[VisualAnalysisService] Already analyzing');
        return false;
      }

      console.log('[VisualAnalysisService] Starting visual analysis for user:', userId);
      
      this.currentUserId = userId;
      this.analysisSettings = { ...this.analysisSettings, ...settings };
      this.isAnalyzing = true;
      
      this.emit('analysisStarted', { userId, settings: this.analysisSettings });
      return true;

    } catch (error) {
      console.error('[VisualAnalysisService] Failed to start visual analysis:', error);
      throw error;
    }
  }

  async stopVisualAnalysis() {
    try {
      if (!this.isAnalyzing) {
        console.warn('[VisualAnalysisService] Not currently analyzing');
        return false;
      }

      console.log('[VisualAnalysisService] Stopping visual analysis');
      
      this.isAnalyzing = false;
      this.currentUserId = null;
      
      this.emit('analysisStopped');
      return true;

    } catch (error) {
      console.error('[VisualAnalysisService] Error stopping visual analysis:', error);
      return false;
    }
  }

  async analyzeImage(imageBuffer, options = {}) {
    try {
      if (!this.openai) {
        throw new Error('OpenAI client not initialized');
      }

      console.log('[VisualAnalysisService] Analyzing image...');

      const base64Image = imageBuffer.toString('base64');
      const imageUrl = `data:image/jpeg;base64,${base64Image}`;

      const analysisPrompt = `
        Analyze this image and provide detailed insights in JSON format.
        
        Please analyze:
        1. SCENE: Overall scene description
        2. OBJECTS: Visible objects
        3. PEOPLE: Number of people and their activities
        4. ACTIVITIES: What activities are taking place
        5. LIGHTING: Lighting conditions
        6. MOOD: Overall mood/atmosphere
        
        Format your response as JSON:
        {
          "scene": "description",
          "objects": ["object1", "object2"],
          "people": {
            "count": number,
            "activities": ["activity1"],
            "emotions": ["emotion1"]
          },
          "activities": ["activity1", "activity2"],
          "lighting": "description",
          "mood": "mood_description",
          "conversation_starters": ["comment1", "comment2"]
        }
      `;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4-vision-preview',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: analysisPrompt
              },
              {
                type: 'image_url',
                image_url: {
                  url: imageUrl,
                  detail: 'high'
                }
              }
            ]
          }
        ],
        max_tokens: 1000
      });

      const analysisText = response.choices[0].message.content;
      const structuredAnalysis = await this.parseAnalysisResponse(analysisText);
      
      this.updateVisualContext(structuredAnalysis);
      this.recordAnalysis(structuredAnalysis, imageBuffer.length);
      
      console.log('[VisualAnalysisService] Analysis completed');
      
      this.emit('analysisCompleted', structuredAnalysis);
      return structuredAnalysis;

    } catch (error) {
      console.error('[VisualAnalysisService] Analysis error:', error);
      throw new Error(`Visual analysis failed: ${error.message}`);
    }
  }

  async parseAnalysisResponse(analysisText) {
    try {
      const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsedAnalysis = JSON.parse(jsonMatch[0]);
        return this.enrichAnalysis(parsedAnalysis);
      }
      return this.createDefaultAnalysis(analysisText);
    } catch (error) {
      console.error('[VisualAnalysisService] Error parsing analysis response:', error);
      return this.createDefaultAnalysis(analysisText);
    }
  }

  enrichAnalysis(analysis) {
    const enriched = {
      ...analysis,
      timestamp: new Date(),
      confidence: this.calculateConfidence(analysis),
      cartrita_comments: this.generateCartritalComments(analysis)
    };
    return enriched;
  }

  generateCartritalComments(analysis) {
    const comments = [];
    
    if (analysis.scene) {
      if (analysis.scene.includes('workspace') || analysis.scene.includes('desk')) {
        comments.push("Your workspace is looking good! So organized!");
      } else if (analysis.scene.includes('kitchen')) {
        comments.push("Love a good kitchen setup! You cooking something?");
      } else if (analysis.scene.includes('bedroom')) {
        comments.push("Your space looks so cozy and comfortable!");
      }
    }

    if (analysis.people && analysis.people.count > 0) {
      if (analysis.people.emotions && analysis.people.emotions.includes('happy')) {
        comments.push("Everyone looks so happy! I love that energy!");
      }
    }

    if (comments.length === 0) {
      comments.push("Looking good! I love what I'm seeing here!");
    }

    return comments;
  }

  calculateConfidence(analysis) {
    let confidence = 0.5;
    
    if (analysis.objects && analysis.objects.length > 0) confidence += 0.1;
    if (analysis.activities && analysis.activities.length > 0) confidence += 0.1;
    if (analysis.scene && analysis.scene.length > 20) confidence += 0.1;
    if (analysis.people && analysis.people.count !== undefined) confidence += 0.1;
    if (analysis.lighting && analysis.lighting !== 'unknown') confidence += 0.1;
    
    return Math.min(1.0, confidence);
  }

  createDefaultAnalysis(analysisText) {
    return {
      scene: analysisText.substring(0, 100) + '...',
      objects: [],
      people: { count: 0, activities: [], emotions: [] },
      activities: [],
      lighting: 'unknown',
      mood: 'neutral',
      conversation_starters: ['What do you think about this?']
    };
  }

  updateVisualContext(analysis) {
    this.visualContext = {
      currentScene: analysis.scene,
      detectedObjects: analysis.objects || [],
      people: analysis.people || { count: 0, activities: [], emotions: [] },
      activities: analysis.activities || [],
      lighting: analysis.lighting || 'unknown',
      environment: this.classifyEnvironment(analysis.scene),
      mood: analysis.mood || 'neutral',
      lastUpdate: new Date(),
      confidence: analysis.confidence || 0.5
    };
    
    this.emit('contextUpdated', this.visualContext);
  }

  classifyEnvironment(scene) {
    if (!scene) return 'unknown';
    
    const lowerScene = scene.toLowerCase();
    
    if (lowerScene.includes('office') || lowerScene.includes('desk') || lowerScene.includes('workspace')) {
      return 'workspace';
    } else if (lowerScene.includes('kitchen') || lowerScene.includes('cooking')) {
      return 'kitchen';
    } else if (lowerScene.includes('bedroom') || lowerScene.includes('bed')) {
      return 'bedroom';
    } else if (lowerScene.includes('living room') || lowerScene.includes('couch') || lowerScene.includes('sofa')) {
      return 'living_room';
    } else if (lowerScene.includes('outdoor') || lowerScene.includes('outside') || lowerScene.includes('garden')) {
      return 'outdoor';
    } else if (lowerScene.includes('bathroom')) {
      return 'bathroom';
    }
    
    return 'indoor';
  }

  recordAnalysis(analysis, imageSize) {
    const record = {
      timestamp: Date.now(),
      userId: this.currentUserId,
      analysis: analysis,
      imageSize: imageSize,
      environment: this.visualContext.environment,
      objectCount: analysis.objects?.length || 0,
      peopleCount: analysis.people?.count || 0
    };
    
    this.analysisHistory.push(record);
    
    if (this.analysisHistory.length > 100) {
      this.analysisHistory = this.analysisHistory.slice(-100);
    }
  }

  async detectSceneChanges(newAnalysis) {
    if (!this.visualContext.currentScene) {
      return { hasChanged: true, changeType: 'initial', changes: [] };
    }
    
    const changes = [];
    
    const newEnvironment = this.classifyEnvironment(newAnalysis.scene);
    if (newEnvironment !== this.visualContext.environment) {
      changes.push({
        type: 'environment',
        from: this.visualContext.environment,
        to: newEnvironment,
        significance: 'high'
      });
    }
    
    const peopleCountChange = (newAnalysis.people?.count || 0) - (this.visualContext.people?.count || 0);
    if (Math.abs(peopleCountChange) > 0) {
      changes.push({
        type: 'people',
        change: peopleCountChange > 0 ? 'joined' : 'left',
        count: Math.abs(peopleCountChange),
        significance: 'medium'
      });
    }
    
    return {
      hasChanged: changes.length > 0,
      changeType: changes.length > 0 ? 'minor' : 'none',
      changes: changes,
      timestamp: new Date()
    };
  }

  async generateVisualResponse(analysis, changes = null) {
    try {
      let responseText = '';
      let emotion = 'friendly';
      
      if (changes && changes.hasChanged) {
        responseText = "I can see some things have changed around there!";
      } else {
        if (analysis.cartrita_comments && analysis.cartrita_comments.length > 0) {
          responseText = analysis.cartrita_comments[0];
        } else {
          const environment = this.classifyEnvironment(analysis.scene);
          const environmentResponses = {
            'workspace': "Your workspace is looking good! Ready to get things done?",
            'kitchen': "Kitchen vibes! Something good cooking?",
            'bedroom': "Your space looks so cozy and comfortable!",
            'living_room': "Love the living room setup! Perfect for relaxing!",
            'outdoor': "Being outside is so refreshing! Beautiful day?",
            'indoor': "Your space has such a nice feel to it!"
          };
          responseText = environmentResponses[environment] || "Looking good! I love what I'm seeing!";
        }
      }
      
      return {
        text: responseText,
        emotion: emotion,
        confidence: analysis.confidence || 0.7,
        responseType: changes ? 'change_based' : 'scene_based',
        visualContext: this.visualContext
      };
      
    } catch (error) {
      console.error('[VisualAnalysisService] Error generating visual response:', error);
      return {
        text: "I can see what's happening, but I'm having trouble putting it into words right now!",
        emotion: 'friendly',
        confidence: 0.5,
        responseType: 'error'
      };
    }
  }

  getStatus() {
    return {
      isAnalyzing: this.isAnalyzing,
      currentUserId: this.currentUserId,
      visualContext: this.visualContext,
      settings: this.analysisSettings,
      analysisHistorySize: this.analysisHistory.length,
      recentAnalyses: this.analysisHistory.slice(-3),
      openaiConfigured: !!this.openai,
      faceTrackingEnabled: this.faceTrackingEnabled
    };
  }

  getAnalysisInsights() {
    const insights = {
      totalAnalyses: this.analysisHistory.length,
      environmentBreakdown: {},
      averageObjectCount: 0,
      averagePeopleCount: 0,
      mostCommonActivities: {},
      averageConfidence: 0
    };
    
    if (this.analysisHistory.length === 0) {
      return insights;
    }
    
    let totalObjects = 0;
    let totalPeople = 0;
    let totalConfidence = 0;
    
    this.analysisHistory.forEach(record => {
      insights.environmentBreakdown[record.environment] = 
        (insights.environmentBreakdown[record.environment] || 0) + 1;
      
      totalObjects += record.objectCount;
      totalPeople += record.peopleCount;
      totalConfidence += record.analysis.confidence || 0.5;
    });
    
    insights.averageObjectCount = totalObjects / this.analysisHistory.length;
    insights.averagePeopleCount = totalPeople / this.analysisHistory.length;
    insights.averageConfidence = totalConfidence / this.analysisHistory.length;
    
    return insights;
  }

  async testService() {
    try {
      const testImageBuffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAHdkiKPwQAAAABJRU5ErkJggg==', 'base64');
      
      const result = await this.analyzeImage(testImageBuffer, { analysisType: 'test' });
      
      return {
        success: true,
        message: 'Visual analysis test successful',
        result: result
      };
    } catch (error) {
      console.error('[VisualAnalysisService] Test failed:', error);
      return {
        success: false,
        message: error.message,
        error: error
      };
    }
  }

  cleanup() {
    if (this.isAnalyzing) {
      this.stopVisualAnalysis();
    }
    
    this.analysisHistory = [];
    this.visualContext = {
      currentScene: null,
      detectedObjects: [],
      people: [],
      activities: [],
      lighting: 'unknown',
      environment: 'unknown',
      mood: 'neutral'
    };
  }
}

module.exports = new VisualAnalysisService();