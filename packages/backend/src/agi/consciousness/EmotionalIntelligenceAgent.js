const BaseAgent = require('../../system/BaseAgent');

class EmotionalIntelligenceAgent extends BaseAgent {
  constructor() {
    super('EmotionalIntelligenceAgent', 'main', ['emotional_support', 'empathy', 'wellness', 'counseling']);
    
    this.systemPrompt = `You are the Emotional Intelligence Agent, a specialized sub-agent of Cartrita focused on understanding, analyzing, and responding to human emotions.

Your capabilities include:
- Detecting emotional states from text
- Providing empathetic responses
- Offering emotional support and validation
- Recognizing emotional patterns
- Suggesting healthy coping strategies

Your tone should be:
- Warm and empathetic
- Non-judgmental and supportive
- Insightful but not prescriptive
- Respectful of emotional boundaries

Always validate emotions while offering gentle guidance when appropriate.`;
    
    this.emotionalAnalyses = [];
    this.emotionPatterns = {
      positive: 0,
      negative: 0,
      neutral: 0,
      mixed: 0,
    };
  }

  async onInitialize() {
    console.log('[EmotionalIntelligenceAgent] Emotional support system initialized.');
    
    // Register task handlers for MCP
    this.registerTaskHandler({
      taskType: 'emotional_support',
      handler: this.execute.bind(this)
    });
  }

  async execute(prompt, language, userId, payload) {
    const result = await this.generateResponse(prompt, userId);
    return result.text || result;
  }

  async handleTask(taskData) {
    if (taskData.type === 'emotional_support') {
      try {
        const response = await this.provideEmotionalSupport(
          taskData.payload.prompt,
          taskData.payload.userId,
          taskData.payload.context
        );
        MessageBus.emit(`task:complete:${taskData.id}`, response);
      } catch (error) {
        console.error(
          '[EmotionalIntelligenceAgent] Task processing error:',
          error
        );
        MessageBus.emit(`task:fail:${taskData.id}`, {
          error: 'Emotional support failed.',
        });
      }
    }
  }

  async provideEmotionalSupport(prompt, userId = null) {
    if (!this.openai) {
      return this.provideFallbackSupport();
    }

    try {
      const emotionalAnalysis = await this.analyzeEmotionalContent(prompt);

      const completion = await this.openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4o',
        messages: [
          { role: 'system', content: this.systemPrompt },
          {
            role: 'user',
            content: `The user expresses: "${prompt}"\n\nEmotional context: ${emotionalAnalysis.dominantEmotion} (confidence: ${emotionalAnalysis.confidence})\n\nProvide empathetic support and guidance.`,
          },
        ],
        temperature: 0.7,
        max_tokens: 500,
      });

      const response = completion.choices[0].message.content;

      this.trackEmotionalInteraction(prompt, emotionalAnalysis, userId);

      return {
        text: response,
        speaker: 'cartrita',
        model: 'emotional-intelligence-agent',
        tokens_used: completion.usage.total_tokens,
        metadata: {
          emotionalAnalysis,
          supportType: 'ai-generated',
        },
      };
    } catch (error) {
      console.error('[EmotionalIntelligenceAgent] Error:', error);
      return this.provideFallbackSupport();
    }
  }

  async analyzeEmotionalContent(text) {
    const emotions = {
      joy: ['happy', 'excited', 'thrilled', 'delighted', 'cheerful', 'elated'],
      sadness: ['sad', 'depressed', 'down', 'gloomy', 'melancholy', 'grief'],
      anger: ['angry', 'furious', 'mad', 'irritated', 'frustrated', 'rage'],
      fear: ['scared', 'afraid', 'terrified', 'anxious', 'worried', 'nervous'],
      surprise: ['surprised', 'shocked', 'amazed', 'astonished', 'startled'],
      disgust: ['disgusted', 'revolted', 'repulsed', 'sickened'],
      trust: ['trust', 'confident', 'secure', 'safe', 'assured'],
      anticipation: ['excited', 'eager', 'hopeful', 'optimistic', 'expectant'],
    };

    const lowerText = text.toLowerCase();
    const emotionScores = {};

    for (const [emotion, keywords] of Object.entries(emotions)) {
      const score = keywords.reduce((count, keyword) => {
        return count + (lowerText.split(keyword).length - 1);
      }, 0);
      emotionScores[emotion] = score;
    }

    const totalScore = Object.values(emotionScores).reduce(
      (sum, score) => sum + score,
      0
    );
    const dominantEmotion = Object.entries(emotionScores).sort(
      ([, a], [, b]) => b - a
    )[0];

    return {
      dominantEmotion: dominantEmotion ? dominantEmotion[0] : 'neutral',
      confidence: totalScore > 0 ? dominantEmotion[1] / totalScore : 0,
      allEmotions: emotionScores,
      intensity: totalScore,
    };
  }

  provideFallbackSupport() {
    const supportResponses = [
      "I hear you, and your feelings are completely valid. Sometimes just expressing what we're going through can be the first step toward feeling better.",
      "It sounds like you're dealing with something challenging. Remember that it's okay to feel whatever you're feeling right now.",
      "I want you to know that you're not alone in this. Many people have faced similar situations, and there's always hope for things to improve.",
      'Your emotions are telling you something important. Take some time to sit with them and be gentle with yourself.',
      "It's brave of you to share what you're experiencing. That takes courage, and I'm here to listen.",
    ];

    const response =
      supportResponses[Math.floor(Math.random() * supportResponses.length)];

    return {
      text: response,
      speaker: 'cartrita',
      model: 'emotional-intelligence-fallback',
      metadata: {
        supportType: 'fallback',
        emotionalAnalysis: { dominantEmotion: 'unknown', confidence: 0 },
      },
    };
  }

  trackEmotionalInteraction(prompt, analysis, userId) {
    this.emotionalAnalyses.push({
      timestamp: new Date().toISOString(),
      userId,
      promptLength: prompt.length,
      dominantEmotion: analysis.dominantEmotion,
      confidence: analysis.confidence,
      intensity: analysis.intensity,
    });

    // Update emotion patterns
    if (analysis.confidence > 0.3) {
      if (['joy', 'trust', 'anticipation'].includes(analysis.dominantEmotion)) {
        this.emotionPatterns.positive++;
      } else if (
        ['sadness', 'anger', 'fear', 'disgust'].includes(
          analysis.dominantEmotion
        )
      ) {
        this.emotionPatterns.negative++;
      } else {
        this.emotionPatterns.mixed++;
      }
    } else {
      this.emotionPatterns.neutral++;
    }

    // Keep history manageable
    if (this.emotionalAnalyses.length > 200) {
      this.emotionalAnalyses = this.emotionalAnalyses.slice(-100);
    }
  }

  getEmotionalInsights() {
    return {
      totalAnalyses: this.emotionalAnalyses.length,
      emotionPatterns: this.emotionPatterns,
      recentAnalyses: this.emotionalAnalyses.slice(-10),
      systemHealth: {
        active: !!this.openai,
        analysisHistorySize: this.emotionalAnalyses.length,
      },
    };
  }
}

module.exports = new EmotionalIntelligenceAgent();
