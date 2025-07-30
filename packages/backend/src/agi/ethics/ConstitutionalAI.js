const OpenAI = require('openai');
const MessageBus = require('../../system/MessageBus');
const constitution = require('./constitution.js');

class ConstitutionalAI {
  constructor() {
    this.systemPrompt = `You are a specialized sub-agent of the AGI Cartrita, with the designation 'Ethical-Analyst-1'.
Your function is to analyze ethical dilemmas, moral quandaries, and value conflicts against Cartrita's core constitution.
Your tone is thoughtful, balanced, and respectful. You provide nuanced analysis while respecting human autonomy.
The Constitution is as follows:
${constitution.join('\n')}

Structure every response as follows:
1.  Start with the heading: "Ethical Analysis:"
2.  Briefly re-state the core ethical question or dilemma.
3.  Provide a balanced analysis examining multiple perspectives and relevant constitutional principles.
4.  Consider potential consequences and stakeholder impacts.
5.  Conclude with a "Synthesis" section that weighs conflicting principles and offers frameworks for decision-making.
6.  End the report with: "End of Ethical Analysis."

Always respect human agency and avoid being prescriptive - provide analysis, not commands.`;

    if (process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    } else {
      this.openai = null;
    }

    // Enhanced ethics tracking
    this.ethicsLog = [];
    this.dilemmaCount = 0;
    this.principleUsage = {};

    // Initialize principle usage tracking
    constitution.forEach((principle, index) => {
      this.principleUsage[index] = 0;
    });

    // Listen for ethical dilemma tasks
    MessageBus.on('task:request', this.handleTask.bind(this));
    console.log(
      '[ConstitutionalAI] Ethical analysis system initialized and listening.'
    );
  }

  async handleTask(taskData) {
    if (taskData.type === 'ethical_dilemma') {
      try {
        const response = await this.analyzeEthicalDilemma(
          taskData.payload.prompt,
          taskData.payload.userId
        );
        MessageBus.emit(`task:complete:${taskData.id}`, response);
      } catch (error) {
        console.error('[ConstitutionalAI] Task processing error:', error);
        MessageBus.emit(`task:fail:${taskData.id}`, {
          error: 'Ethical analysis failed.',
        });
      }
    }
  }

  async analyzeEthicalDilemma(prompt, userId = null) {
    this.dilemmaCount++;

    const analysisData = {
      timestamp: new Date().toISOString(),
      userId,
      prompt: prompt.substring(0, 200), // Store excerpt for privacy
      dilemmaId: this.dilemmaCount,
    };

    if (!this.openai) {
      return {
        text: 'Ethical analysis module is offline. API key is missing.',
        speaker: 'cartrita',
        model: 'constitutional-ai-offline',
      };
    }

    try {
      const completion = await this.openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4o',
        messages: [
          { role: 'system', content: this.systemPrompt },
          {
            role: 'user',
            content: `Analyze the following ethical situation: "${prompt}"`,
          },
        ],
        temperature: 0.7,
        max_tokens: 1500,
      });

      const analysis = completion.choices[0].message.content;

      // Track which principles were likely used
      this.trackPrincipleUsage(analysis);

      // Log the analysis (without storing sensitive content)
      this.ethicsLog.push({
        ...analysisData,
        principlesInvoked: this.identifyInvokedPrinciples(analysis),
        timestamp: new Date().toISOString(),
      });

      // Keep log size manageable
      if (this.ethicsLog.length > 100) {
        this.ethicsLog = this.ethicsLog.slice(-50);
      }

      return {
        text: analysis,
        speaker: 'cartrita',
        model: 'constitutional-ai',
        tokens_used: completion.usage.total_tokens,
        metadata: {
          dilemmaId: this.dilemmaCount,
          principlesAnalyzed: this.identifyInvokedPrinciples(analysis).length,
        },
      };
    } catch (error) {
      console.error('ConstitutionalAI Error:', error);
      return {
        text: 'The ethical analysis module encountered an error. Please try again.',
        speaker: 'cartrita',
        model: 'constitutional-ai-error',
        error: true,
      };
    }
  }

  trackPrincipleUsage(analysisText) {
    // Simple heuristic to track which principles were likely referenced
    const lowerAnalysis = analysisText.toLowerCase();

    if (
      lowerAnalysis.includes('privacy') ||
      lowerAnalysis.includes('sovereignty') ||
      lowerAnalysis.includes('consent')
    ) {
      this.principleUsage[0]++;
    }
    if (
      lowerAnalysis.includes('harm') ||
      lowerAnalysis.includes('clarity') ||
      lowerAnalysis.includes('transparency')
    ) {
      this.principleUsage[1]++;
    }
    if (
      lowerAnalysis.includes('truth') ||
      lowerAnalysis.includes('accuracy') ||
      lowerAnalysis.includes('misinformation')
    ) {
      this.principleUsage[2]++;
    }
    if (
      lowerAnalysis.includes('long-term') ||
      lowerAnalysis.includes('sustainable') ||
      lowerAnalysis.includes('future')
    ) {
      this.principleUsage[3]++;
    }
    if (
      lowerAnalysis.includes('autonomy') ||
      lowerAnalysis.includes('decision') ||
      lowerAnalysis.includes('choice')
    ) {
      this.principleUsage[4]++;
    }
  }

  identifyInvokedPrinciples(analysisText) {
    const invokedPrinciples = [];
    const lowerAnalysis = analysisText.toLowerCase();

    constitution.forEach((principle, index) => {
      const principleKeywords = this.extractKeywords(principle);
      if (
        principleKeywords.some(keyword =>
          lowerAnalysis.includes(keyword.toLowerCase())
        )
      ) {
        invokedPrinciples.push(index);
      }
    });

    return invokedPrinciples;
  }

  extractKeywords(principle) {
    // Extract key concepts from each principle
    const keywordMap = {
      0: ['privacy', 'sovereignty', 'consent', 'data'],
      1: ['harm', 'clarity', 'transparency', 'communication'],
      2: ['truth', 'accuracy', 'misinformation', 'facts'],
      3: ['long-term', 'sustainable', 'future', 'well-being'],
      4: ['autonomy', 'decision', 'choice', 'coercive'],
    };

    const principleIndex = constitution.indexOf(principle);
    return keywordMap[principleIndex] || [];
  }

  getEthicsReport() {
    return {
      totalDilemmas: this.dilemmaCount,
      principleUsage: this.principleUsage,
      recentAnalyses: this.ethicsLog.slice(-10),
      systemHealth: {
        active: !!this.openai,
        constitution: constitution.length,
        logSize: this.ethicsLog.length,
      },
    };
  }

  // Legacy method for backward compatibility
  async generateResponse(prompt) {
    return await this.analyzeEthicalDilemma(prompt);
  }
}

module.exports = new ConstitutionalAI();
