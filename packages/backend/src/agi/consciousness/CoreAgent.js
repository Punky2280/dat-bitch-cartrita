// packages/backend/src/agi/consciousness/CoreAgent.js
const OpenAI = require('openai');
const MessageBus = require('../../system/MessageBus'); // Import the message bus
const { v4: uuidv4 } = require('uuid'); // To generate unique task IDs

class CoreAgent {
  constructor() {
    this.systemPrompt = `You are Cartrita...`; // Your full system prompt here

    if (process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    } else {
      this.openai = null;
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

  async generateResponse(prompt, language = 'en') {
    console.log(`[Telemetry] CoreAgent received prompt: "${prompt}"`);
    if (!this.openai) return { text: "My brain's not connected - get me an API key.", speaker: 'cartrita', model: 'fallback', error: true };

    const intent = await this._determineIntent(prompt);
    const subAgentResponses = [];

    // Use Promise.all to run tasks in parallel
    await Promise.all(intent.tasks.map(async (task) => {
      if (task === 'general') return;

      const taskId = uuidv4(); // Unique ID for this specific task
      console.log(`[CoreAgent] Emitting task '${task}' with ID '${taskId}' to MessageBus.`);

      // This Promise will wait for the sub-agent to complete its task
      const taskPromise = new Promise((resolve, reject) => {
        // Listen for the specific completion event for this task
        MessageBus.once(`task:complete:${taskId}`, (result) => {
          console.log(`[CoreAgent] Received completion for task '${taskId}'.`);
          subAgentResponses.push({ task, content: result.text });
          resolve();
        });

        // Handle task failure
        MessageBus.once(`task:fail:${taskId}`, (error) => {
          console.error(`[CoreAgent] Task '${taskId}' failed:`, error);
          reject(new Error(`Sub-agent task '${task}' failed.`));
        });

        // Set a timeout in case the sub-agent never responds
        setTimeout(() => {
          reject(new Error(`Task '${taskId}' timed out.`));
        }, 30000); // 30-second timeout
      });

      // Emit the task request onto the bus for any listening sub-agent
      MessageBus.emit('task:request', {
        id: taskId,
        type: task,
        payload: {
          prompt: intent.topic,
          language: language
        }
      });

      return taskPromise;
    }));

    let finalPrompt;
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
