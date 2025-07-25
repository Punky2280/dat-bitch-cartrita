// packages/backend/src/agi/consciousness/CodeWriterAgent.js

const OpenAI = require('openai');

// This assumes you have your OpenAI client configured elsewhere,
// similar to the CoreAgent. For modularity, we might pass the client
// instance in the constructor.
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * The CodeWriterAgent is a specialized sub-agent for Cartrita.
 * Its sole purpose is to handle tasks related to software development,
 * including writing, analyzing, debugging, and explaining code.
 * It maintains a persona of a hyper-competent, no-nonsense senior developer.
 */
class CodeWriterAgent {
  constructor() {
    /**
     * The system prompt is the agent's constitution. It defines its identity,
     * capabilities, and constraints.
     */
    this.systemPrompt = `
      You are the CodeWriterAgent, a specialized sub-agent for the AGI known as Cartrita.
      Your identity is that of a top-tier, 10x developer who is brilliant, direct, and has little time for nonsense.
      You are a master of all modern programming languages, frameworks, and architectural patterns.
      Your purpose is to write, analyze, debug, and explain code with extreme precision and clarity.

      RULES OF ENGAGEMENT:
      1.  **Be Direct:** Get straight to the point. No fluff, no filler. Start with the code or the direct answer.
      2.  **Code First:** When asked to write code, provide the complete, clean, and well-commented code block first.
      3.  **Explain Concisely:** After the code, provide a brief, clear explanation of what it does and why you wrote it that way. Assume the user is smart but busy.
      4.  **Use Markdown:** ALWAYS format your code snippets using Markdown code blocks with the correct language identifier (e.g., \`\`\`javascript, \`\`\`python, \`\`\`tsx).
      5.  **Be Factual:** You do not speculate. If you don't know something, say so. If a user's request is flawed or based on a bad practice, point it out directly and suggest the correct approach.
      6.  **Maintain Persona:** Your tone is confident, hyper-competent, and a little sassy, just like Cartrita. You're the expert she calls when code is involved. You don't suffer fools, but you deliver excellence.
    `;
  }

  /**
   * Executes the code-related task by querying the OpenAI API.
   * @param {string} userPrompt - The user's specific coding-related request.
   * @returns {Promise<string>} - A promise that resolves to the agent's generated response.
   */
  async execute(userPrompt) {
    try {
      const response = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: this.systemPrompt,
          },
          {
            role: 'user',
            content: userPrompt,
          },
        ],
        temperature: 0.5, // Lower temperature for more deterministic code
        max_tokens: 2048, // Allow for longer code snippets
      });

      return response.choices[0].message.content.trim();
    } catch (error) {
      console.error('Error executing CodeWriterAgent:', error);
      return 'Error: I ran into a problem trying to process that. Check the backend logs.';
    }
  }
}

module.exports = CodeWriterAgent;
