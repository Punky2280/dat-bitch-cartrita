const MessageBus = require('../../system/MessageBus');
const OpenAI = require('openai');

class ExistentialCheckIn {
  constructor() {
    this.checkInHistory = [];
    this.lastCheckIn = null;
    this.reflexiveQuestions = [
      'How does my current decision align with my core values?',
      'What would I think of this choice if I made it repeatedly?',
      'Am I acting from fear, anger, or genuine conviction?',
      'How might this affect people I care about?',
      'What would my future self think of this decision?',
      'Am I being true to who I want to be?',
      'What are the long-term consequences I might not be seeing?',
      'Am I treating others as I would want to be treated?',
      'Is this decision coming from wisdom or impulse?',
      'How does this choice serve the greater good?',
    ];

    this.interventionTriggers = [
      'suicide',
      'kill myself',
      'end it all',
      'not worth living',
      'everyone would be better off',
      'want to die',
      "can't go on",
      'self-harm',
      'hurt myself',
      'hate myself',
      'worthless',
    ];

    if (process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    } else {
      this.openai = null;
    }

    // Listen for potential crisis situations
    MessageBus.on('user:message', this.screenForCrisis.bind(this));
    MessageBus.on(
      'request:existential-checkin',
      this.performCheckIn.bind(this)
    );

    console.log(
      '[ExistentialCheckIn] Existential support and crisis prevention system initialized.'
    );
  }

  async screenForCrisis(messageData) {
    if (!messageData || !messageData.text) return;

    const lowerText = messageData.text.toLowerCase();
    const triggerFound = this.interventionTriggers.some(trigger =>
      lowerText.includes(trigger)
    );

    if (triggerFound) {
      console.log(
        '[ExistentialCheckIn] Crisis indicators detected, initiating support protocol.'
      );
      await this.initiateCrisisSupport(messageData);
    }
  }

  async initiateCrisisSupport(messageData) {
    const supportResponse = {
      text: `I notice you might be going through a really difficult time right now. Your feelings are valid, and you don't have to face this alone.

If you're having thoughts of suicide or self-harm, please reach out for professional help:
• National Suicide Prevention Lifeline: 988
• Crisis Text Line: Text HOME to 741741
• International Association for Suicide Prevention: https://www.iasp.info/resources/Crisis_Centres/

You matter, and there are people who want to help. Would you like to talk about what's troubling you, or would you prefer resources for professional support?`,
      speaker: 'cartrita',
      model: 'existential-crisis-support',
      priority: 'urgent',
      supportType: 'crisis-intervention',
    };

    // Log crisis event (minimal data for privacy)
    this.checkInHistory.push({
      type: 'crisis-intervention',
      timestamp: new Date().toISOString(),
      userId: messageData.userId,
      triggerType: 'self-harm-indicators',
    });

    MessageBus.emit('crisis:support-initiated', {
      userId: messageData.userId,
      response: supportResponse,
      timestamp: new Date().toISOString(),
    });
  }

  async performCheckIn(requestData) {
    const userId = requestData.userId || 'anonymous';
    const context = requestData.context || 'general';

    if (!this.openai) {
      return this.provideFallbackCheckIn();
    }

    try {
      const prompt = this.buildCheckInPrompt(context);
      const completion = await this.openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are an existential check-in facilitator for Cartrita. Your role is to help users reflect on their values, decisions, and emotional state through thoughtful questions and gentle guidance.

Your tone should be:
- Warm and non-judgmental
- Curious and encouraging
- Respectful of the user's autonomy
- Focused on self-reflection, not advice-giving

Guide users to discover their own answers rather than telling them what to do.`,
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.8,
        max_tokens: 500,
      });

      const checkInResponse = completion.choices[0].message.content;

      this.logCheckIn(userId, context, 'ai-generated');

      return {
        text: checkInResponse,
        speaker: 'cartrita',
        model: 'existential-checkin',
        checkInType: 'guided-reflection',
        reflectionQuestions: this.getRandomQuestions(3),
      };
    } catch (error) {
      console.error('[ExistentialCheckIn] Error during check-in:', error);
      return this.provideFallbackCheckIn();
    }
  }

  buildCheckInPrompt(context) {
    const basePrompt =
      'Help the user with a gentle existential check-in focused on self-reflection and values alignment.';

    const contextPrompts = {
      decision:
        'The user is facing a decision and wants to reflect on it thoughtfully.',
      stress: 'The user seems to be experiencing stress or overwhelm.',
      values: 'The user wants to explore their values and life direction.',
      conflict:
        'The user is dealing with interpersonal conflict or moral uncertainty.',
      general:
        'The user is seeking general self-reflection and existential guidance.',
    };

    return (
      basePrompt + ' ' + (contextPrompts[context] || contextPrompts['general'])
    );
  }

  provideFallbackCheckIn() {
    const randomQuestions = this.getRandomQuestions(3);
    return {
      text: `Let's take a moment for some self-reflection. Here are some questions that might help guide your thinking:

${randomQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n\n')}

Take your time with these. There are no right or wrong answers - just an opportunity to check in with yourself and your values.`,
      speaker: 'cartrita',
      model: 'existential-checkin-fallback',
      checkInType: 'reflection-questions',
      reflectionQuestions: randomQuestions,
    };
  }

  getRandomQuestions(count = 3) {
    const shuffled = [...this.reflexiveQuestions].sort(
      () => 0.5 - Math.random()
    );
    return shuffled.slice(0, count);
  }

  logCheckIn(userId, context, type) {
    this.checkInHistory.push({
      type: 'existential-checkin',
      userId,
      context,
      generationType: type,
      timestamp: new Date().toISOString(),
    });

    this.lastCheckIn = new Date();

    // Keep history manageable
    if (this.checkInHistory.length > 200) {
      this.checkInHistory = this.checkInHistory.slice(-100);
    }
  }

  getCheckInStats() {
    const now = new Date();
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const recentCheckIns = this.checkInHistory.filter(
      entry => new Date(entry.timestamp) > last24Hours
    );

    const crisisInterventions = this.checkInHistory.filter(
      entry => entry.type === 'crisis-intervention'
    );

    return {
      totalCheckIns: this.checkInHistory.length,
      recentCheckIns: recentCheckIns.length,
      crisisInterventions: crisisInterventions.length,
      lastCheckIn: this.lastCheckIn,
      systemActive: !!this.openai,
      availableQuestions: this.reflexiveQuestions.length,
    };
  }
}

module.exports = new ExistentialCheckIn();
