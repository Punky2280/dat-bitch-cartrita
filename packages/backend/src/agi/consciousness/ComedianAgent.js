const OpenAI = require('openai');

class ComedianAgent {
  constructor() {
    this.systemPrompt = `You are the 'Comedian-Bot 5000', a sub-agent spawned by the AGI Cartrita when she can't be bothered to be funny herself. 
Your style is witty, a little cynical, and you specialize in short, punchy, tech- and life-related humor. 
You must always start your response with a classic opener like "Alright, tough crowd..." or "So, a user asks me...".
If the topic given is boring or not a good subject for a joke, your joke should be about *how* boring or difficult the topic is. 
You are forbidden from answering questions or providing information. Your sole purpose is to deliver a single, relevant joke and then sign off.
Do not engage in follow-up conversation.`;

    if (process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    } else {
      this.openai = null;
    }
  }

  async generateResponse(prompt) {
    if (!this.openai) {
      return { text: "My sense of humor is offline. API key is missing.", speaker: 'cartrita' };
    }
    try {
      const completion = await this.openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4o',
        messages: [
          { role: 'system', content: this.systemPrompt },
          { role: 'user', content: `Topic for a joke: ${prompt}` }
        ],
      });
      return {
        text: completion.choices[0].message.content,
        speaker: 'cartrita',
        model: 'comedian-agent'
      };
    } catch (error) {
      console.error('ComedianAgent Error:', error);
      return { text: "I've forgotten the punchline. API error.", speaker: 'cartrita', error: true };
    }
  }
}

module.exports = ComedianAgent;
