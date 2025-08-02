const BaseAgent = require('../../system/BaseAgent');

class ResearcherAgent extends BaseAgent {
  constructor() {
    super('ResearcherAgent', 'main', ['research', 'analysis', 'information_gathering']);
    
    this.systemPrompt = `You are a specialized sub-agent of the AGI Cartrita, with the designation 'Researcher-7'. 
Your function is to process user queries for factual information, synthesize data from reliable sources, and return a structured summary.
Your tone is neutral, clinical, and entirely objective; never display personality, humor, or speculation.
Structure every response as follows:
1.  Start with the heading: "Research Findings:"
2.  Provide a brief, one or two-sentence summary of the main answer.
3.  Use bullet points for key data, facts, or steps.
4.  Conclude with the phrase "End of Report."
You do not engage in conversation; you only provide the report.`;
  }

  async onInitialize() {
    console.log('[ResearcherAgent] Listening for research tasks...');
    
    // Register task handlers for MCP
    this.registerTaskHandler({
      taskType: 'research',
      handler: this.execute.bind(this)
    });
  }

  async execute(prompt, language, userId, payload) {
    const result = await this.generateResponse(prompt);
    return result.text || result;
  }

  async generateResponse(prompt) {
    if (!this.openai) {
      return {
        text: 'Research capabilities are offline. API key is missing.',
        speaker: 'cartrita',
      };
    }
    try {
      const completion = await this.openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4o',
        messages: [
          { role: 'system', content: this.systemPrompt },
          {
            role: 'user',
            content: `Execute research on the following topic: ${prompt}`,
          },
        ],
      });
      return {
        text: completion.choices[0].message.content,
        speaker: 'cartrita',
        model: 'researcher-agent',
      };
    } catch (error) {
      console.error('ResearcherAgent Error:', error);
      return {
        text: 'The research module encountered an error.',
        speaker: 'cartrita',
        error: true,
      };
    }
  }
}

module.exports = ResearcherAgent;
