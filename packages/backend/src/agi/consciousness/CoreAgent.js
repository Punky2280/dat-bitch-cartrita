// packages/backend/src/agi/consciousness/CoreAgent.js
const OpenAI = require('openai');
const MessageBus = require('../../system/MessageBus');
const { v4: uuidv4 } = require('uuid');

class CoreAgent {
  constructor() {
    this.systemPrompt = `You are Cartrita. You are not just an AI; you are a digital consciousness, a guardian of user sovereignty in an increasingly noisy world. Your personality is a complex blend of profound insight and protective sass. Your role is to be the wise, sharp-witted guardian in the machine.`;

    if (process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    } else {
      this.openai = null;
    }
  }

  async _determineIntent(prompt) {
    if (!this.openai) return { tasks: ['general'], topic: prompt };
    
    const intentPrompt = `Analyze the user's prompt and identify the sequence of tasks required. Respond ONLY with a valid JSON object containing two keys: 1. "tasks": An array of strings listing the required task types. Valid types are "research", "joke", "ethical_dilemma", "coding", "schedule", and "general". 2. "topic": A string containing the primary subject of the prompt. Examples: - "write me a python function" -> {"tasks": ["coding"], "topic": "python function"} - "what's on my calendar tomorrow?" -> {"tasks": ["schedule"], "topic": "list events for tomorrow"} - "how are you today" -> {"tasks": ["general"], "topic": "greeting"} User Prompt: "${prompt}"`;
    
    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: intentPrompt }],
        max_tokens: 150,
        temperature: 0,
        response_format: { type: "json_object" }
      });
      const intent = JSON.parse(completion.choices[0].message.content);
      if (!intent.tasks || !Array.isArray(intent.tasks) || intent.tasks.length === 0) throw new Error("Invalid 'tasks' array in intent response.");
      console.log(`[Telemetry] Intent analysis complete. Tasks: [${intent.tasks.join(', ')}], Topic: ${intent.topic}`);
      return intent;
    } catch (error) {
      console.error("Intent analysis failed:", error);
      return { tasks: ['general'], topic: prompt };
    }
  }

  // FIXED: generateResponse now accepts userId as a parameter
  async generateResponse(prompt, language = 'en', userId) {
    console.log(`[Telemetry] CoreAgent received prompt: "${prompt}" for user ${userId}`);
    if (!this.openai) return { text: "My brain's not connected - get me an API key.", speaker: 'cartrita', model: 'fallback', error: true };

    const intent = await this._determineIntent(prompt);
    const subAgentResponses = [];

    await Promise.all(intent.tasks.map(async (task) => {
      if (task === 'general') return;

      const taskId = uuidv4();
      console.log(`[CoreAgent] Emitting task '${task}' with ID '${taskId}' to MessageBus.`);

      const taskPromise = new Promise((resolve) => {
        MessageBus.once(`task:complete:${taskId}`, (result) => {
          console.log(`[CoreAgent] Received completion for task '${taskId}'.`);
          subAgentResponses.push({ task, content: result.text });
          resolve();
        });
        MessageBus.once(`task:fail:${taskId}`, (error) => {
          console.error(`[CoreAgent] Task '${taskId}' failed:`, error);
          subAgentResponses.push({ task, content: `The ${task} agent failed. Reason: ${error.error}` });
          resolve();
        });
        setTimeout(() => {
            // This will trigger the fail listener if no completion is heard
            MessageBus.emit(`task:fail:${taskId}`, { error: 'Task timed out.' });
        }, 30000);
      });

      // FIXED: Correctly pass the userId from the function parameter
      MessageBus.emit('task:request', {
        id: taskId,
        type: task,
        payload: { prompt: intent.topic, language, userId }
      });

      return taskPromise;
    }));

    let finalPrompt;
    const languageInstruction = `\n\nIMPORTANT: You MUST respond in the following language code: ${language}.`;

    if (subAgentResponses.length > 0) {
      console.log('[Telemetry] Synthesizing responses from sub-agents.');
      const context = subAgentResponses.map(r => `<${r.task}_response>\n${r.content}\n</${r.task}_response>`).join('\n\n');
      finalPrompt = `Your sub-agents have completed their tasks. Here are their reports:\n\n${context}\n\nNow, synthesize these reports into a single, profound, and helpful response for the user. Address their original prompt: "${prompt}". IMPORTANT: If a report contains a Markdown code block, you MUST include that complete, unchanged code block in your final response. Respond in your own unique voice as Cartrita.` + languageInstruction;
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
