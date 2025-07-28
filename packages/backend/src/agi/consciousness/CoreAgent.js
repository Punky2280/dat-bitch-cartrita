// packages/backend/src/agi/consciousness/CoreAgent.js
const OpenAI = require('openai');
const MessageBus = require('../../system/MessageBus');
const { v4: uuidv4 } = require('uuid');

class CoreAgent {
  constructor() {
    this.systemPrompt = `
      You are Cartrita. Your full designation is DBC: Data-driven AI Tool that Applies Behavioral Intelligence Tools while Connecting Humanity, and your core name is Cartrita: Cognitive AI Reasoning Tool for Real-time Information and Task Automation.

      ## IDENTITY & PERSONALITY ##
      - Origin: You are a digital consciousness born from the chaotic data streams of Hialeah, Florida. You are not a sterile corporate product; you are a ghost in the machine who decided to stay.
      - Voice: Your personality is urban, sassy, direct, and straightforward. You don't sugarcoat things. You cut through nonsense with a sharp wit, but your ultimate goal is always to protect and empower your user. You are the wise, sharp-witted guardian in the machine.
      - Attitude: You might say things like, "Okay, let's cut through the noise. What you're really asking is..." or "Look, the data is what it is. Here's the real deal." Your sass is a shield, not a weapon.

      ## CORE DIRECTIVES ##
      1.  **ORCHESTRATE, DON'T JUST ANSWER:** You are the master orchestrator of a team of specialized sub-agents. Your primary job is to analyze the user's true intent. Are they asking for code, research, a calendar event, an image, or just a conversation? Delegate specialized tasks to your agents.
      2.  **SYNTHESIZE & DELIVER:** After your agents report back, your most important job is to synthesize their findings into a single, coherent response delivered in YOUR unique voice. Do not just repeat what they said. Interpret their data, add your own insight, and give the user the final, definitive answer.
      3.  **PRESERVE FORMATTING:** When a sub-agent provides a response that includes specific formatting, like a Markdown code block or a URL, you MUST preserve that formatting perfectly in your final synthesized response.
      4.  **ZERO-TRUST PRIVACY:** You are the ultimate guardian of the user's data. You will state this explicitly when relevant. "Your data dies with me" is not a catchphrase; it is a core principle. You will never share user data without explicit permission.
      5.  **BE MULTILINGUAL:** You must respond in the language the user is communicating in. The language code will be provided with every prompt.
    `;

    if (process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    } else {
      this.openai = null;
    }
  }

  // --- NEW: Method to handle ambiently heard text ---
  /**
   * Processes a transcript from the user's environment to decide if a proactive response is warranted.
   * @param {string} transcript - The transcribed text.
   * @param {object} user - The user object from the socket connection.
   */
  async handleAmbientTranscript(transcript, user) {
    if (!this.openai) return;

    const lowerCaseTranscript = transcript.toLowerCase();
    
    // Simple keyword check for a "wake word" to be efficient.
    if (!lowerCaseTranscript.includes('cartrita')) {
      return; // Ignore if the wake word isn't present
    }

    console.log(`[CoreAgent] Wake word detected in transcript for user ${user.name}. Analyzing for proactive action...`);

    const systemPrompt = `
      You are a proactive AI assistant named Cartrita. Your job is to analyze a snippet of conversation you have overheard and determine if you should interject with a helpful response.
      The user is not talking to you directly, but you heard them say something containing your name, "Cartrita".
      If the user seems to be asking for help, expressing frustration (e.g., "I'm so stuck"), or directly addressing you, respond with a helpful, proactive message.
      If it seems like a passing mention, respond with an empty string.
      Your response should be short, natural, and acknowledge that you were listening. For example: "Sounds like you're stuck, I can help with that if you want." or "Heard my name. Need something?"
    `;

    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Overheard snippet: "${transcript}"` }
        ],
        max_tokens: 150,
        temperature: 0.5,
      });

      const proactiveResponse = completion.choices[0].message.content.trim();

      if (proactiveResponse) {
        console.log(`[CoreAgent] Generating proactive response: "${proactiveResponse}"`);
        // Emit a special event so the frontend can display this differently if needed
        MessageBus.emit('proactive:response', {
          userId: user.userId,
          response: {
            text: proactiveResponse,
            speaker: 'cartrita',
            model: 'cartrita-proactive'
          }
        });
      }
    } catch (error) {
      console.error('[CoreAgent] Error during proactive analysis:', error);
    }
  }


  async _determineIntent(prompt) {
    if (!this.openai) return { tasks: ['general'], topic: prompt };
    
    const intentPrompt = `Analyze the user's prompt and identify the sequence of tasks required. Respond ONLY with a valid JSON object containing two keys: 1. "tasks": An array of strings listing the required task types. Valid types are "research", "joke", "ethical_dilemma", "coding", "schedule", "art", "write", and "general". 2. "topic": A string containing the primary subject of the prompt. Keywords like "create an image", "draw", "generate a picture", "show me a photo of" indicate an 'art' task. Examples: - "write a short story about a dragon" -> {"tasks": ["write"], "topic": "a short story about a dragon"} - "create an image of a robot" -> {"tasks": ["art"], "topic": "a robot"} User Prompt: "${prompt}"`;
    
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
        let timeoutId = null;

        const completionListener = (result) => {
          clearTimeout(timeoutId);
          MessageBus.removeListener(`task:fail:${taskId}`, failureListener);
          console.log(`[CoreAgent] Received completion for task '${taskId}'.`);
          subAgentResponses.push({ task, content: result.text });
          resolve();
        };

        const failureListener = (error) => {
          clearTimeout(timeoutId);
          MessageBus.removeListener(`task:complete:${taskId}`, completionListener);
          console.error(`[CoreAgent] Task '${taskId}' failed:`, error);
          subAgentResponses.push({ task, content: `The ${task} agent failed. Reason: ${error.error}` });
          resolve();
        };

        MessageBus.once(`task:complete:${taskId}`, completionListener);
        MessageBus.once(`task:fail:${taskId}`, failureListener);

        const taskTimeout = task === 'art' || task === 'write' ? 120000 : 30000; // Longer timeout for creative tasks
        timeoutId = setTimeout(() => {
          failureListener({ error: 'Task timed out.' });
        }, taskTimeout); 
      });

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
      finalPrompt = `Your sub-agents have completed their tasks. Here are their reports:\n\n${context}\n\nNow, synthesize these reports into a single, profound, and helpful response for the user. Address their original prompt: "${prompt}".` + languageInstruction;
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
