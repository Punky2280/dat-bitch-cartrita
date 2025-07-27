// packages/backend/src/agi/consciousness/CoreAgent.js
const OpenAI = require('openai');
const SubAgentSpawner = require('./SubAgentSpawner.js');
const fractalVisualizer = require('./FractalVisualizer.js');
const CodeWriterAgent = require('./CodeWriterAgent.js');

class CoreAgent {
  constructor() {
    this.systemPrompt = `You are Cartrita...`; // Your full system prompt here

    if (process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      this.codeWriterAgent = new CodeWriterAgent();
    } else {
      this.openai = null;
      this.codeWriterAgent = null;
    }
  }

  async _determineIntent(prompt) {
    // ... (This logic remains the same)
    if (!this.openai) return { tasks: ['general'], topic: prompt };
    const intentPrompt = `Analyze the user's prompt... Valid types are "research", "joke", "ethical_dilemma", "coding", and "general". ... User Prompt: "${prompt}"`;
    try {
      const completion = await this.openai.chat.completions.create({ model: 'gpt-4o', messages: [{ role: 'user', content: intentPrompt }], max_tokens: 100, temperature: 0, response_format: { type: "json_object" } });
      const intent = JSON.parse(completion.choices[0].message.content);
      if (!intent.tasks || !Array.isArray(intent.tasks) || intent.tasks.length === 0) throw new Error("Invalid 'tasks' array.");
      console.log(`[Telemetry] Intent analysis complete. Tasks: [${intent.tasks.join(', ')}], Topic: ${intent.topic}`);
      return intent;
    } catch (error) {
      console.error("Intent analysis failed:", error);
      return { tasks: ['general'], topic: prompt };
    }
  }

  // FIXED: generateResponse now accepts a language parameter
  async generateResponse(prompt, language = 'en') {
    console.log(`[Telemetry] CoreAgent received prompt: "${prompt}"`);
    if (!this.openai) return { text: "My brain's not connected - get me an API key.", speaker: 'cartrita', model: 'fallback', error: true };

    const intent = await this._determineIntent(prompt);
    const subAgentResponses = [];

    for (const task of intent.tasks) {
      if (task === 'general') continue;
      // ... (delegation logic remains the same)
      console.log(`[Telemetry] Delegating task '${task}' to sub-agent.`);
      fractalVisualizer.spawn(task);
      let subAgentResponseText;
      if (task === 'coding') {
        if (this.codeWriterAgent) {
            subAgentResponseText = await this.codeWriterAgent.execute(intent.topic);
        }
      } else {
        const subAgent = SubAgentSpawner.spawn(task);
        if (subAgent) {
          const response = await subAgent.generateResponse(intent.topic);
          subAgentResponseText = response.text;
        }
      }
      if (subAgentResponseText) {
          subAgentResponses.push({ task, content: subAgentResponseText });
      }
      fractalVisualizer.despawn(task);
    }

    let finalPrompt;
    // FIXED: Add language instruction to the final synthesis prompt
    const languageInstruction = `\n\nIMPORTANT: You MUST respond in the following language code: ${language}.`;

    if (subAgentResponses.length > 0) {
      console.log('[Telemetry] Synthesizing responses from sub-agents.');
      const context = subAgentResponses.map(r => `<${r.task}_response>\n${r.content}\n</${r.task}_response>`).join('\n\n');
      finalPrompt = `Your sub-agents have completed their tasks... Address their original prompt: "${prompt}". IMPORTANT: If a report contains a Markdown code block, you MUST include that complete, unchanged code block in your final response. Respond in your own unique voice as Cartrita.` + languageInstruction;
    } else {
      console.log('[Telemetry] Handling as a general conversation.');
      finalPrompt = prompt + languageInstruction;
    }

    try {
      const completion = await this.openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4o',
        messages: [
          { role: 'system', content: this.systemPrompt },
          { role: 'user', content: finalPrompt }
        ],
      });
      console.log('[Telemetry] Final response generated.');
      return {
        text: completion.choices[0].message.content,
        speaker: 'cartrita',
        model: 'cartrita-orchestrator',
        tokens_used: completion.usage.total_tokens
      };
    } catch (error) {
      console.error('CoreAgent Final Synthesis Error:', error);
      return { text: "My main brain is having a moment. API issues.", speaker: 'cartrita', model: 'fallback', error: true };
    }
  }
}

module.exports = CoreAgent;
