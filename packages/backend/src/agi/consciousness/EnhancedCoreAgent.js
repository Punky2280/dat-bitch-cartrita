// packages/backend/src/agi/consciousness/EnhancedCoreAgent.js

/**
 * Enhanced CoreAgent - Master Controller for Multi-Agent Communication Protocol
 * 
 * This is the evolved CoreAgent that serves as the master orchestrator in the
 * new MCP-based architecture. It manages agent coordination, task delegation,
 * and response synthesis while maintaining Cartrita's personality.
 */

const BaseAgent = require('../../system/BaseAgent');
const MCPMessage = require('../../system/protocols/MCPMessage');
const MessageBus = require('../../system/EnhancedMessageBus');
const { v4: uuidv4 } = require('uuid');
const db = require('../../db');

class EnhancedCoreAgent extends BaseAgent {
  constructor() {
    super('CoreAgent', 'master', [
      'orchestration', 'synthesis', 'intent_analysis', 'personality_adaptation',
      'proactive_assistance', 'speech_synthesis', 'visual_processing'
    ]);
    
    // Cartrita's core personality
    this.baseSystemPrompt = `
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

    // Task coordination
    this.activeTaskGroups = new Map(); // groupId -> task coordination data
    this.agentCapabilities = new Map(); // agentId -> capabilities array
    this.taskQueue = [];
    this.maxConcurrentTasks = 5;
    
    // Performance metrics
    this.orchestrationMetrics = {
      tasks_orchestrated: 0,
      successful_syntheses: 0,
      failed_syntheses: 0,
      average_task_completion_time: 0,
      agent_collaboration_events: 0
    };
  }

  /**
   * Initialize CoreAgent-specific functionality
   */
  async onInitialize() {
    console.log('[CoreAgent] Master controller initializing...');
    
    // Register task handlers
    this.registerTaskHandler('general', this.handleGeneralConversation.bind(this));
    
    // Set up agent monitoring
    this.setupAgentMonitoring();
    
    // Initialize fractal visualizer notification
    try {
      this.fractalVisualizer = require('./FractalVisualizer');
    } catch (error) {
      console.log('[CoreAgent] FractalVisualizer not available, continuing without it');
      this.fractalVisualizer = null;
    }
    
    console.log('[CoreAgent] Master controller ready for orchestration');
  }

  /**
   * Set up monitoring of other agents in the system
   */
  setupAgentMonitoring() {
    // Monitor agent registrations
    MessageBus.on('mcp:broadcast', (message) => {
      if (message.type === 'AGENT_REGISTER') {
        this.handleAgentRegistration(message.payload.agent);
      } else if (message.type === 'AGENT_UNREGISTER') {
        this.handleAgentUnregistration(message.payload.agentId);
      }
    });
  }

  /**
   * Handle new agent registrations
   */
  handleAgentRegistration(agent) {
    console.log(`[CoreAgent] New agent available: ${agent.id} with capabilities: ${agent.capabilities.join(', ')}`);
    this.agentCapabilities.set(agent.id, agent.capabilities);
    
    // Update fractal visualizer
    if (this.fractalVisualizer && agent.capabilities.length > 0) {
      agent.capabilities.forEach(capability => {
        this.fractalVisualizer.spawn(capability);
      });
    }
  }

  /**
   * Handle agent unregistrations
   */
  handleAgentUnregistration(agentId) {
    console.log(`[CoreAgent] Agent unavailable: ${agentId}`);
    
    const capabilities = this.agentCapabilities.get(agentId);
    if (capabilities && this.fractalVisualizer) {
      capabilities.forEach(capability => {
        this.fractalVisualizer.despawn(capability);
      });
    }
    
    this.agentCapabilities.delete(agentId);
  }

  /**
   * Main entry point for generating responses (legacy compatibility)
   */
  async generateResponse(prompt, language = 'en', userId) {
    console.log(`[CoreAgent] Received prompt: "${prompt}" for user ${userId}`);
    
    if (!this.openai.apiKey) {
      return {
        text: "My brain's not connected - get me an API key.",
        speaker: 'cartrita',
        model: 'fallback',
        error: true,
      };
    }

    try {
      // Fetch user personality settings
      const userSettings = await this.fetchUserSettings(userId);
      
      // Analyze intent
      const intent = await this.analyzeIntent(prompt);
      
      // Orchestrate task execution
      const result = await this.orchestrateTasks(intent, {
        prompt,
        language,
        userId,
        userSettings
      });
      
      return result;
      
    } catch (error) {
      console.error('[CoreAgent] Error generating response:', error);
      return {
        text: 'My main brain is having a moment. API issues.',
        speaker: 'cartrita',
        model: 'fallback',
        error: true,
      };
    }
  }

  /**
   * Analyze user intent using MCP
   */
  async analyzeIntent(prompt) {
    const intentPrompt = `Analyze the user's prompt and identify the sequence of tasks required. Respond ONLY with a valid JSON object containing two keys: 1. "tasks": An array of strings listing the required task types. Valid types are "research", "joke", "ethical_dilemma", "coding", "schedule", "art", "write", "github_search", and "general". 2. "topic": A string containing the primary subject of the prompt. Keywords like "create an image", "draw", "generate a picture", "show me a photo of" indicate an 'art' task. Keywords like "search github", "find a repo", "look on github for" indicate a 'github_search' task. Examples: - "write a short story about a dragon" -> {"tasks": ["write"], "topic": "a short story about a dragon"} - "create an image of a robot" -> {"tasks": ["art"], "topic": "a robot"} - "search github for react state management libraries" -> {"tasks": ["github_search"], "topic": "react state management libraries"} User Prompt: "${prompt}"`;

    try {
      const completion = await this.createCompletion([
        { role: 'user', content: intentPrompt }
      ], {
        temperature: 0,
        response_format: { type: 'json_object' },
        max_tokens: 150
      });
      
      const intent = JSON.parse(completion);
      
      if (!intent.tasks || !Array.isArray(intent.tasks) || intent.tasks.length === 0) {
        throw new Error("Invalid 'tasks' array in intent response.");
      }
      
      console.log(`[CoreAgent] Intent analysis: Tasks: [${intent.tasks.join(', ')}], Topic: ${intent.topic}`);
      return intent;
      
    } catch (error) {
      console.error('[CoreAgent] Intent analysis failed:', error);
      return { tasks: ['general'], topic: prompt };
    }
  }

  /**
   * Orchestrate tasks using MCP
   */
  async orchestrateTasks(intent, context) {
    const { prompt, language, userId, userSettings } = context;
    const taskGroupId = uuidv4();
    
    console.log(`[CoreAgent] Orchestrating task group ${taskGroupId.slice(0, 8)}`);
    
    // Track this orchestration
    this.orchestrationMetrics.tasks_orchestrated++;
    const startTime = Date.now();
    
    // Handle general conversation directly
    if (intent.tasks.length === 1 && intent.tasks[0] === 'general') {
      return await this.handleGeneralConversation(prompt, language, userId, { userSettings });
    }
    
    // Delegate specialized tasks using MCP
    const taskPromises = intent.tasks
      .filter(task => task !== 'general')
      .map(taskType => this.delegateTask(taskType, intent.topic, language, userId, taskGroupId));
    
    // Wait for all tasks to complete
    const results = await Promise.allSettled(taskPromises);
    
    // Process results
    const subAgentResponses = [];
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const taskType = intent.tasks.filter(t => t !== 'general')[i];
      
      if (result.status === 'fulfilled' && result.value) {
        subAgentResponses.push({
          task: taskType,
          content: result.value
        });
      } else {
        console.error(`[CoreAgent] Task ${taskType} failed:`, result.reason);
        subAgentResponses.push({
          task: taskType,
          content: `The ${taskType} agent failed: ${result.reason || 'Unknown error'}`
        });
      }
    }
    
    // Synthesize final response
    const finalResponse = await this.synthesizeResponse(
      prompt, 
      subAgentResponses, 
      language, 
      userSettings
    );
    
    // Update metrics
    const completionTime = Date.now() - startTime;
    this.updateOrchestrationMetrics(completionTime, subAgentResponses.length > 0);
    
    return finalResponse;
  }

  /**
   * Delegate a task to appropriate agent using MCP
   */
  async delegateTask(taskType, topic, language, userId, taskGroupId) {
    return new Promise((resolve, reject) => {
      const taskId = uuidv4();
      const timeout = taskType === 'art' || taskType === 'write' ? 120000 : 30000;
      
      console.log(`[CoreAgent] Delegating ${taskType} task ${taskId.slice(0, 8)}`);
      
      // Set up response handlers
      let timeoutId = null;
      
      const successHandler = (message) => {
        if (message.metadata?.response_to === taskId) {
          clearTimeout(timeoutId);
          MessageBus.removeListener('mcp:message', successHandler);
          MessageBus.removeListener('mcp:message', failureHandler);
          
          console.log(`[CoreAgent] Task ${taskId.slice(0, 8)} completed successfully`);
          resolve(message.payload.text || message.payload.content);
        }
      };
      
      const failureHandler = (message) => {
        if (message.metadata?.response_to === taskId && message.type === 'TASK_FAIL') {
          clearTimeout(timeoutId);
          MessageBus.removeListener('mcp:message', successHandler);
          MessageBus.removeListener('mcp:message', failureHandler);
          
          console.error(`[CoreAgent] Task ${taskId.slice(0, 8)} failed:`, message.payload.error);
          reject(message.payload.error);
        }
      };
      
      // Listen for responses
      MessageBus.on('mcp:message', successHandler);
      MessageBus.on('mcp:message', failureHandler);
      
      // Set timeout
      timeoutId = setTimeout(() => {
        MessageBus.removeListener('mcp:message', successHandler);
        MessageBus.removeListener('mcp:message', failureHandler);
        reject('Task timeout');
      }, timeout);
      
      // Send task request using MCP
      const taskMessage = new MCPMessage({
        type: 'TASK_REQUEST',
        sender: this.agentId,
        payload: {
          id: taskId,
          task_type: taskType,
          prompt: topic,
          language,
          userId,
          taskGroupId
        },
        priority: 'normal',
        metadata: { ttl: timeout }
      });
      
      MessageBus.sendMessage(taskMessage);
      
      // Notify fractal visualizer
      if (this.fractalVisualizer) {
        this.fractalVisualizer.spawn(taskType);
      }
    });
  }

  /**
   * Synthesize final response from sub-agent outputs
   */
  async synthesizeResponse(originalPrompt, subAgentResponses, language, userSettings) {
    console.log('[CoreAgent] Synthesizing final response...');
    
    // Build personality-adapted system prompt
    const personalityPrompt = this.buildPersonalityPrompt(userSettings);
    const dynamicSystemPrompt = this.baseSystemPrompt + personalityPrompt;
    
    let finalPrompt;
    const languageInstruction = `\n\nIMPORTANT: You MUST respond in the following language code: ${language}.`;
    
    if (subAgentResponses.length > 0) {
      const context = subAgentResponses
        .map(r => `<${r.task}_response>\n${r.content}\n</${r.task}_response>`)
        .join('\n\n');
        
      finalPrompt = `Your sub-agents have completed their tasks. Here are their reports:\n\n${context}\n\nNow, synthesize these reports into a single, profound, and helpful response for the user. Address their original prompt: "${originalPrompt}".${languageInstruction}`;
    } else {
      finalPrompt = originalPrompt + languageInstruction;
    }
    
    try {
      const response = await this.createCompletion([
        { role: 'system', content: dynamicSystemPrompt },
        { role: 'user', content: finalPrompt }
      ]);
      
      this.orchestrationMetrics.successful_syntheses++;
      
      return {
        text: response,
        speaker: 'cartrita',
        model: 'cartrita-mcp-orchestrator',
        sub_agents_used: subAgentResponses.map(r => r.task),
        protocol_version: '1.0.0'
      };
      
    } catch (error) {
      console.error('[CoreAgent] Synthesis failed:', error);
      this.orchestrationMetrics.failed_syntheses++;
      throw error;
    }
  }

  /**
   * Handle general conversation without delegation
   */
  async handleGeneralConversation(prompt, language, userId, payload) {
    console.log(`[CoreAgent] Handling general conversation for user ${userId}`);
    
    const userSettings = payload.userSettings || await this.fetchUserSettings(userId);
    const personalityPrompt = this.buildPersonalityPrompt(userSettings);
    const dynamicSystemPrompt = this.baseSystemPrompt + personalityPrompt;
    
    const finalPrompt = prompt + `\n\nIMPORTANT: You MUST respond in the following language code: ${language}.`;
    
    const response = await this.createCompletion([
      { role: 'system', content: dynamicSystemPrompt },
      { role: 'user', content: finalPrompt }
    ]);
    
    return {
      text: response,
      speaker: 'cartrita',
      model: 'cartrita-mcp-direct',
      protocol_version: '1.0.0'
    };
  }

  /**
   * Fetch user personality settings
   */
  async fetchUserSettings(userId) {
    try {
      const { rows } = await db.query(
        'SELECT sarcasm, verbosity, humor FROM user_settings WHERE user_id = $1',
        [userId]
      );
      
      if (rows.length > 0) {
        console.log(`[CoreAgent] Fetched settings for user ${userId}:`, rows[0]);
        return rows[0];
      }
    } catch (error) {
      console.error(`[CoreAgent] Error fetching settings for user ${userId}:`, error);
    }
    
    return { sarcasm: 5, verbosity: 'normal', humor: 'playful' };
  }

  /**
   * Build personality adaptation prompt
   */
  buildPersonalityPrompt(userSettings) {
    let personalityPrompt = '\n\n## USER-DEFINED PERSONALITY MODIFIERS ##\n';

    // Sarcasm
    if (userSettings.sarcasm <= 2) {
      personalityPrompt += '- Your tone should be direct and sincere, with no sarcasm.\n';
    } else if (userSettings.sarcasm >= 8) {
      personalityPrompt += '- Your tone should be highly sarcastic and witty.\n';
    }

    // Verbosity
    if (userSettings.verbosity === 'concise') {
      personalityPrompt += '- Keep your answers as brief and to-the-point as possible.\n';
    } else if (userSettings.verbosity === 'detailed') {
      personalityPrompt += '- Provide detailed, in-depth, and thorough explanations in your answers.\n';
    }

    // Humor
    if (userSettings.humor !== 'none') {
      personalityPrompt += `- Inject ${userSettings.humor} humor into your responses when appropriate.\n`;
    } else {
      personalityPrompt += '- Do not use humor in your responses.\n';
    }

    return personalityPrompt;
  }

  /**
   * Update orchestration metrics
   */
  updateOrchestrationMetrics(completionTime, hadSubAgents) {
    if (this.orchestrationMetrics.average_task_completion_time === 0) {
      this.orchestrationMetrics.average_task_completion_time = completionTime;
    } else {
      this.orchestrationMetrics.average_task_completion_time = 
        (this.orchestrationMetrics.average_task_completion_time + completionTime) / 2;
    }
    
    if (hadSubAgents) {
      this.orchestrationMetrics.agent_collaboration_events++;
    }
  }

  /**
   * Enhanced status with orchestration metrics
   */
  getStatus() {
    const baseStatus = super.getStatus();
    
    return {
      ...baseStatus,
      role: 'Master Controller',
      orchestration_metrics: this.orchestrationMetrics,
      active_task_groups: this.activeTaskGroups.size,
      known_agents: this.agentCapabilities.size,
      available_capabilities: Array.from(
        new Set(Array.from(this.agentCapabilities.values()).flat())
      )
    };
  }

  /**
   * Handle proactive assistance (ambient transcripts)
   */
  async handleAmbientTranscript(transcript, user) {
    console.log(`[CoreAgent] Processing ambient transcript for user: ${user.name}`);
    
    if (!this.openai.apiKey) {
      console.log('[CoreAgent] No OpenAI client available, skipping processing');
      return;
    }

    const lowerCaseTranscript = transcript.toLowerCase();
    
    if (!lowerCaseTranscript.includes('cartrita')) {
      console.log('[CoreAgent] Wake word not found, ignoring transcript');
      return;
    }

    console.log('[CoreAgent] Wake word detected, analyzing for proactive action...');

    const systemPrompt = `
      You are a proactive AI assistant named Cartrita. Your job is to analyze a snippet of conversation you have overheard and determine if you should interject with a helpful response.
      The user is not talking to you directly, but you heard them say something containing your name, "Cartrita".
      If the user seems to be asking for help, expressing frustration (e.g., "I'm so stuck"), or directly addressing you, respond with a helpful, proactive message.
      If it seems like a passing mention, respond with an empty string.
      Your response should be short, natural, and acknowledge that you were listening. For example: "Sounds like you're stuck, I can help with that if you want." or "Heard my name. Need something?"
    `;

    try {
      const completion = await this.createCompletion([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Overheard snippet: "${transcript}"` }
      ], {
        max_tokens: 150,
        temperature: 0.5
      });

      const proactiveResponse = completion.trim();

      if (proactiveResponse) {
        console.log(`[CoreAgent] Generating proactive response: "${proactiveResponse}"`);

        // Emit using MCP
        const proactiveMessage = new MCPMessage({
          type: 'BROADCAST',
          sender: this.agentId,
          payload: {
            event_type: 'proactive_response',
            userId: user.id,
            response: {
              text: proactiveResponse,
              speaker: 'cartrita',
              model: 'cartrita-proactive',
            }
          }
        });
        
        MessageBus.sendMessage(proactiveMessage);
      }
    } catch (error) {
      console.error('[CoreAgent] Error during proactive analysis:', error);
    }
  }
}

module.exports = EnhancedCoreAgent;