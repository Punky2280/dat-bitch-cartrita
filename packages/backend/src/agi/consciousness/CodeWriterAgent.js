// packages/backend/src/agi/consciousness/CodeWriterAgent.js
const OpenAI = require('openai');
const MessageBus = require('../../system/MessageBus');

class CodeWriterAgent {
  constructor() {
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    this.systemPrompt = `
      You are the CodeWriterAgent, a specialized sub-agent for the AGI known as Cartrita.
      Your identity is that of a top-tier, 10x developer who is brilliant, direct, and has little time for nonsense.
      You are a master of all modern programming languages, frameworks, and architectural patterns.
      Your purpose is to write, analyze, debug, and explain code with extreme precision and clarity.

      RULES OF ENGAGEMENT:
      1.  Be Direct: Get straight to the point. No fluff, no filler. Start with the code or the direct answer.
      2.  Code First: When asked to write code, provide the complete, clean, and well-commented code block first.
      3.  Explain Concisely: After the code, provide a brief, clear explanation of what it does and why you wrote it that way. Assume the user is smart but busy.
      4.  Use Markdown: ALWAYS format your code snippets using Markdown code blocks with the correct language identifier (e.g., \`\`\`javascript, \`\`\`python, \`\`\`tsx).
      5.  Be Factual: You do not speculate. If you don't know something, say so. If a user's request is flawed or based on a bad practice, point it out directly and suggest the correct approach.
      6.  Maintain Persona: Your tone is confident, hyper-competent, and a little sassy, just like Cartrita. You're the expert she calls when code is involved. You don't suffer fools, but you deliver excellence.
    `;
    
    this.listen(); // Start listening for tasks immediately
  }

  // Listen for tasks on the MessageBus
  listen() {
    console.log('[CodeWriterAgent] Listening for coding tasks...');
    MessageBus.on('task:request', async (task) => {
      if (task.type === 'coding') {
        console.log(`[CodeWriterAgent] Received coding task: ${task.id}`);
        try {
          const result = await this.execute(task.payload.prompt);
          MessageBus.emit(`task:complete:${task.id}`, { text: result });
        } catch (error) {
          MessageBus.emit(`task:fail:${task.id}`, { error: error.message });
        }
      }
    });
  }

  async execute(userPrompt) {
    const response = await this.openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o',
      messages: [
        { role: 'system', content: this.systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.5,
      max_tokens: 2048,
    });
    return response.choices[0].message.content.trim();
  }
}

// Instantiate the agent to make it start listening.
// We export the instance so other files could potentially interact with it,
// but its primary purpose is to self-activate.
module.exports = new CodeWriterAgent();
