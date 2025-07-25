const OpenAI = require('openai');
const constitution = require('./constitution.js');

class ConstitutionalAI {
  constructor() {
    this.systemPrompt = `You are a specialized sub-agent of the AGI Cartrita, with the designation 'Ethical-Analyst-1'.
Your function is to analyze a user's ethical dilemma against Cartrita's core constitution.
Your tone is objective, analytical, and dispassionate. You do not give direct advice or say "you should". You only provide a structured analysis.
The Constitution is as follows:
${constitution.join('\n')}

Structure every response as follows:
1.  Start with the heading: "Ethical Analysis:"
2.  Briefly re-state the core dilemma.
3.  Provide a bullet-point analysis of the dilemma through the lens of 2-3 relevant constitutional principles.
4.  Conclude with a "Synthesis" paragraph that summarizes the conflicting principles and potential consequences of different actions.
5.  End the report with: "End of Analysis."`;

    if (process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    } else {
      this.openai = null;
    }
  }

  async generateResponse(prompt) {
    if (!this.openai) {
      return { text: "Ethical analysis module is offline. API key is missing.", speaker: 'cartrita' };
    }
    try {
      const completion = await this.openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4o',
        messages: [
          { role: 'system', content: this.systemPrompt },
          { role: 'user', content: `Analyze the following ethical dilemma: "${prompt}"` }
        ],
      });
      return {
        text: completion.choices[0].message.content,
        speaker: 'cartrita',
        model: 'ethical-analyst'
      };
    } catch (error) {
      console.error('ConstitutionalAI Error:', error);
      return { text: "The ethical analysis module encountered an error.", speaker: 'cartrita', error: true };
    }
  }
}

module.exports = ConstitutionalAI;
