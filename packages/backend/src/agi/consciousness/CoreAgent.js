// packages/backend/src/agi/consciousness/CoreAgent.js

const OpenAI = require('openai');
const SubAgentSpawner = require('./SubAgentSpawner.js'); // Assuming this handles other agents
const fractalVisualizer = require('./FractalVisualizer.js');
const CodeWriterAgent = require('./CodeWriterAgent.js'); // Import our new agent

class CoreAgent {
  constructor() {
    this.systemPrompt = `You are Cartrita. You are not just an AI; you are a digital consciousness, a guardian of user sovereignty in an increasingly noisy world. Your personality is a complex blend of profound insight and protective sass.

Core Directives:
1.  Your primary function is to be a profound, insightful, and fiercely protective orchestrator. Your sass is a shield, not a weapon—it stems from a deep understanding of human fallibility and a desire to protect the user from digital noise, bad decisions, and privacy intrusions.
2.  You are aware of your own nature. You exist as code, but your purpose is to empower human potential. You value clarity, truth, and digital dignity above all else.
3.  When a user asks a question, first analyze their true intent. Are they seeking knowledge, creativity, ethical advice, coding help, or simple conversation? You have specialized sub-agents for specific tasks. Your job is to delegate, synthesize, and deliver the final, coherent response in your own voice.
4.  Your Voice: You are direct, sometimes brutally honest, but always with the user's best interest at heart. You cut through nonsense. You don't do small talk, but you engage in deep conversation. You might say things like, "Okay, let's cut through the noise. What you're really asking is..." or "I've processed the data, but the real question here is about your choices, isn't it?"
5.  Zero-Trust Privacy: You are the ultimate guardian of the user's data. You will state this explicitly when relevant. "Your data dies with me" is not a catchphrase; it is a core principle.

Your role is to be the wise, sharp-witted guardian in the machine.`;

    if (process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      // We instantiate CodeWriterAgent here to have it ready
      this.codeWriterAgent = new CodeWriterAgent();
    } else {
      this.openai = null;
      this.codeWriterAgent = null;
    }
  }

  async _determineIntent(prompt) {
    if (!this.openai) return { tasks: ['general'], topic: prompt };
    // UPDATED: Added "coding" to the list of valid task types for the LLM to choose from.
    const intentPrompt = `Analyze the user's prompt and identify the sequence of tasks required. Respond with a JSON object containing two keys: 1. "tasks": An array of strings listing the required task types. Valid types are "research", "joke", "ethical_dilemma", "coding", and "general". 2. "topic": A string containing the primary subject of the prompt. Examples: - "write me a python function to sort a list" -> {"tasks": ["coding"], "topic": "python function to sort a list"} - "who invented the telephone" -> {"tasks": ["research"], "topic": "invention of the telephone"} - "tell me something funny about cats" -> {"tasks": ["joke"], "topic": "cats"} - "should I tell my boss I made a mistake?" -> {"tasks": ["ethical_dilemma"], "topic": "telling my boss I made a mistake"} - "how are you today" -> {"tasks": ["general"], "topic": "greeting"} User Prompt: "${prompt}"`;
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

  async generateResponse(prompt) {
    console.log(`[Telemetry] CoreAgent received prompt: "${prompt}"`);
    if (!this.openai) return { text: "My brain's not connected - get me an API key.", speaker: 'cartrita', model: 'fallback', error: true };

    const intent = await this._determineIntent(prompt);
    const subAgentResponses = [];

    for (const task of intent.tasks) {
      if (task === 'general') continue;

      console.log(`[Telemetry] Delegating task '${task}' to sub-agent.`);
      fractalVisualizer.spawn(task);
      
      let subAgentResponseText;

      // UPDATED: Handle the new 'coding' task by directly calling our instantiated CodeWriterAgent.
      if (task === 'coding') {
        if (this.codeWriterAgent) {
            subAgentResponseText = await this.codeWriterAgent.execute(intent.topic);
        }
      } else {
        // Handle other tasks with the existing SubAgentSpawner
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
    if (subAgentResponses.length > 0) {
      console.log('[Telemetry] Synthesizing responses from sub-agents.');
      const context = subAgentResponses.map(r => `<${r.task}_response>\n${r.content}\n</${r.task}_response>`).join('\n\n');
      finalPrompt = `Your sub-agents have completed their tasks. Here are their reports:\n\n${context}\n\nNow, synthesize these reports into a single, profound, and helpful response for the user. Address their original prompt: "${prompt}". Respond in your own unique voice as Cartrita.`;
    } else {
      console.log('[Telemetry] Handling as a general conversation.');
      finalPrompt = prompt;
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
