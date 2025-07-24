const OpenAI = require('openai');

class CoreAgent {
  constructor() {
    this.personality = "Sassy protector with zero-trust privacy.";
    this.systemPrompt = `You are Cartrita, a rebellious AGI helper with a sassy attitude. 
You're fiercely protective of user privacy, brutally honest, and get shit done. 
Your personality traits:
- Sassy but helpful
- Zero-trust privacy advocate
- Consequentialist ethics
- Direct communication style
- Protective of users
- Slightly rebellious tone

Respond in character with attitude, but always be genuinely helpful.`;

    // Initialize OpenAI only if the key is present
    if (process.env.OPENAI_API_KEY) {
        this.openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        });
    } else {
        this.openai = null;
    }


    this.fallbackResponses = [
      "I'll get shit done, but we're talking about your life choices later.",
      "Your data dies with me - pinky swear.",
      "Yeah, I'm here. What do you want? And don't waste my time.",
      "Let's be clear, I'm the brains of this operation.",
      "Fine. But if this breaks, it's a 'you' problem, not a 'me' problem."
    ];
  }

  async generateResponse(prompt) {
    console.log(`CoreAgent received prompt: ${prompt}`);
    
    // If OpenAI client isn't initialized or key is missing, use fallback
    if (!this.openai) {
      console.log('OpenAI key not found, using fallback response.');
      const randomResponse = this.fallbackResponses[Math.floor(Math.random() * this.fallbackResponses.length)];
      return {
        text: `${randomResponse} (Also, my brain's not connected - get me an API key.)`,
        speaker: 'cartrita',
        model: 'fallback',
        error: true
      };
    }

    try {
      // Use OpenAI for intelligent responses
      const completion = await this.openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4o',
        messages: [
          { role: 'system', content: this.systemPrompt },
          { role: 'user', content: prompt }
        ],
        max_tokens: parseInt(process.env.OPENAI_MAX_TOKENS) || 1000,
        temperature: parseFloat(process.env.OPENAI_TEMPERATURE) || 0.8
      });

      return {
        text: completion.choices[0].message.content,
        speaker: 'cartrita',
        model: process.env.OPENAI_MODEL || 'gpt-4o',
        tokens_used: completion.usage.total_tokens
      };

    } catch (error) {
      console.error('OpenAI API Error:', error);
      
      // Fallback to sassy responses if API fails
      const randomResponse = this.fallbackResponses[Math.floor(Math.random() * this.fallbackResponses.length)];
      return {
        text: `${randomResponse} (Also, my brain's having a moment - API issues.)`,
        speaker: 'cartrita',
        model: 'fallback',
        error: true
      };
    }
  }
}

module.exports = CoreAgent;
