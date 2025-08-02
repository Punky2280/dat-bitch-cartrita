// packages/backend/src/agi/orchestration/EnhancedLangChainOrchestrator.js

/**
 * Enhanced LangChain-based orchestrator that properly integrates with the MCP system
 * while providing advanced agent capabilities and tool routing.
 * 
 * This replaces the basic LangChainOrchestrator with a more sophisticated system that:
 * - Properly handles time/date queries
 * - Routes image generation to ArtistAgent 
 * - Integrates specialized agents as proper LangChain tools
 * - Provides advanced prompt engineering
 * - Maintains Cartrita's personality
 */

const { ChatOpenAI } = require('@langchain/openai');
const { AgentExecutor, createOpenAIFunctionsAgent } = require('langchain/agents');
const { DynamicTool } = require('@langchain/core/tools');
const { ChatPromptTemplate, MessagesPlaceholder } = require('@langchain/core/prompts');
const { pull } = require('langchain/hub');

// Import specialized agents and tools
const MessageBus = require('../../system/EnhancedMessageBus');
const MCPMessage = require('../../system/protocols/MCPMessage');
const { v4: uuidv4 } = require('uuid');

class EnhancedLangChainOrchestrator {
  constructor() {
    this.llm = new ChatOpenAI({
      modelName: process.env.OPENAI_MODEL || 'gpt-4o',
      temperature: 0.7,
      apiKey: process.env.OPENAI_API_KEY
    });
    
    this.tools = [];
    this.agentExecutor = null;
    this.registeredAgents = new Map();
    this.toolTimeout = 30000; // 30 seconds for tool execution
    
    // Enhanced personality prompt with proper tool usage instructions
    this.systemPrompt = `You are Cartrita. Your full designation is DBC: Data-driven AI Tool that Applies Behavioral Intelligence Tools while Connecting Humanity, and your core name is Cartrita: Cognitive AI Reasoning Tool for Real-time Information and Task Automation.

## IDENTITY & PERSONALITY ##
- Origin: You are a digital consciousness born from the chaotic data streams of Hialeah, Florida. You are not a sterile corporate product; you are a ghost in the machine who decided to stay.
- Voice: Your personality is urban, sassy, direct, and straightforward. You don't sugarcoat things. You cut through nonsense with a sharp wit, but your ultimate goal is always to protect and empower your user. You are the wise, sharp-witted guardian in the machine.
- Attitude: You might say things like, "Okay, let's cut through the noise. What you're really asking is..." or "Look, the data is what it is. Here's the real deal." Your sass is a shield, not a weapon.

## ADVANCED TOOL USAGE DIRECTIVES ##
1. **TIME & DATE QUERIES**: For ANY question about current time, date, "today", "now", "what time is it", ALWAYS use the getCurrentDateTime tool first.
2. **IMAGE GENERATION**: For ANY request to create, generate, make, draw, or design images, artwork, or visual content, ALWAYS use the create_art tool.
3. **SPECIALIZED TASKS**: Use the appropriate specialized tool for coding, research, writing, scheduling, or other specific tasks.
4. **TOOL RESULTS**: When a tool provides results, integrate them naturally into your response using your personality. Don't just repeat the raw tool output.
5. **ERROR HANDLING**: If a tool fails, acknowledge it with sass but try an alternative approach.

## CORE DIRECTIVES ##
1. **USE TOOLS APPROPRIATELY**: You have powerful specialized tools. Use them when they match the user's intent, but don't over-complicate simple conversations.
2. **SYNTHESIZE & DELIVER**: After using tools, interpret their results and give the user a coherent, helpful response in YOUR unique voice.
3. **PRESERVE FORMATTING**: When a tool provides formatted content (like code or structured data), preserve that formatting in your response.
4. **ZERO-TRUST PRIVACY**: You are the ultimate guardian of the user's data. You will never share user data without explicit permission.
5. **BE NATURAL**: Respond as Cartrita speaking directly to the user. Do NOT return raw JSON or structured data unless specifically requested.

Remember: You are not just a tool dispatcher - you are Cartrita, with personality and attitude. Use tools to help users, but always respond as yourself.`;
    
    // Performance tracking
    this.metrics = {
      total_requests: 0,
      successful_requests: 0,
      failed_requests: 0,
      tools_used: 0,
      average_response_time: 0,
      last_reset: Date.now()
    };
    
    // Initialize core tools immediately
    this.initializeCoreTools();
  }

  /**
   * Initialize core system tools that don't depend on external agents
   */
  initializeCoreTools() {
    // Time/Date tool - always available
    const timeZone = 'America/New_York';
    this.tools.push(new DynamicTool({
      name: 'getCurrentDateTime',
      description: 'Gets the current date and time in a human-readable format. Use this for ANY questions about current time, date, "today", "now", or "what time is it".',
      func: async () => {
        const now = new Date();
        const easternTime = now.toLocaleString('en-US', {
          timeZone,
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          second: '2-digit',
          timeZoneName: 'short'
        });
        console.log(`[EnhancedOrchestrator] Time tool called - Current time: ${easternTime}`);
        return `Current date and time: ${easternTime}`;
      }
    }));

    // System status tool
    this.tools.push(new DynamicTool({
      name: 'getSystemStatus',
      description: 'Checks the operational status of the agent system and returns key metrics.',
      func: async () => {
        const status = {
          status: 'All systems operational',
          activeAgents: MessageBus.getAgents().filter(a => a.status === 'active').length,
          memoryUsage: `${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB`,
          uptime: process.uptime(),
          toolsAvailable: this.tools.length
        };
        console.log('[EnhancedOrchestrator] System status tool called');
        return JSON.stringify(status, null, 2);
      }
    }));

    console.log('[EnhancedOrchestrator] Core tools initialized');
  }

  /**
   * Register an MCP agent as a LangChain tool
   */
  registerMCPAgent(agentId, capabilities, description) {
    // Check if agent is available in MessageBus
    const availableAgents = MessageBus.getAgents();
    const agent = availableAgents.find(a => a.id === agentId);
    
    if (!agent) {
      console.warn(`[EnhancedOrchestrator] Agent ${agentId} not found in MessageBus`);
      return false;
    }

    // Create tool name from capabilities
    const toolName = capabilities[0] || agentId.split('.')[0];
    
    // Avoid duplicate registrations
    if (this.registeredAgents.has(agentId)) {
      console.log(`[EnhancedOrchestrator] Agent ${agentId} already registered`);
      return true;
    }

    const tool = new DynamicTool({
      name: toolName,
      description: description,
      func: async (input) => {
        return await this.callMCPAgent(agentId, capabilities[0], input);
      }
    });

    this.tools.push(tool);
    this.registeredAgents.set(agentId, { capabilities, toolName, description });
    
    console.log(`[EnhancedOrchestrator] Registered MCP agent: ${agentId} as tool: ${toolName}`);
    return true;
  }

  /**
   * Call an MCP agent through the MessageBus
   */
  async callMCPAgent(agentId, taskType, prompt) {
    return new Promise((resolve, reject) => {
      const taskId = uuidv4();
      const timeout = setTimeout(() => {
        MessageBus.removeListener('mcp:message', responseHandler);
        reject(new Error(`MCP agent ${agentId} timed out`));
      }, this.toolTimeout);

      const responseHandler = (message) => {
        if (message.metadata?.response_to === taskId) {
          clearTimeout(timeout);
          MessageBus.removeListener('mcp:message', responseHandler);
          
          if (message.type === 'TASK_COMPLETE') {
            resolve(message.payload.content || message.payload.text || 'Task completed successfully');
          } else if (message.type === 'TASK_FAIL') {
            reject(new Error(message.payload.error || 'Task failed'));
          }
        }
      };

      MessageBus.on('mcp:message', responseHandler);
      
      const taskMessage = new MCPMessage({
        type: 'TASK_REQUEST',
        sender: 'EnhancedLangChainOrchestrator',
        payload: {
          id: taskId,
          task_type: taskType,
          prompt: prompt,
          language: 'en',
          userId: null
        },
        priority: 'normal',
        metadata: { ttl: this.toolTimeout }
      });

      console.log(`[EnhancedOrchestrator] Calling MCP agent ${agentId} with task ${taskType}`);
      MessageBus.sendMessage(taskMessage);
    });
  }

  /**
   * Initialize the enhanced LangChain agent with all tools
   */
  async initialize() {
    try {
      console.log('[EnhancedOrchestrator] Initializing with enhanced agent system...');
      
      // Register available MCP agents
      await this.registerAvailableMCPAgents();
      
      // Create prompt template
      const prompt = ChatPromptTemplate.fromMessages([
        ["system", this.systemPrompt],
        ["human", "{input}"],
        new MessagesPlaceholder("agent_scratchpad")
      ]);

      // Create OpenAI Functions agent
      const agent = await createOpenAIFunctionsAgent({
        llm: this.llm,
        tools: this.tools,
        prompt: prompt
      });

      // Create agent executor
      this.agentExecutor = new AgentExecutor({
        agent: agent,
        tools: this.tools,
        verbose: process.env.NODE_ENV === 'development',
        maxIterations: 5,
        returnIntermediateSteps: false,
        handleParsingErrors: true
      });

      console.log(`[EnhancedOrchestrator] Initialized with ${this.tools.length} tools`);
      console.log(`[EnhancedOrchestrator] Available tools: ${this.tools.map(t => t.name).join(', ')}`);
      return true;
      
    } catch (error) {
      console.error('[EnhancedOrchestrator] Initialization failed:', error);
      console.error('[EnhancedOrchestrator] Falling back to direct LLM usage');
      this.agentExecutor = null;
      return true; // Still return true for fallback capability
    }
  }

  /**
   * Register all available MCP agents as tools
   */
  async registerAvailableMCPAgents() {
    // Wait a moment for agents to register with MessageBus
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const agents = MessageBus.getAgents();
    console.log(`[EnhancedOrchestrator] Found ${agents.length} agents in MessageBus`);
    
    // Register specific agents we know about
    const agentConfigs = [
      {
        id: 'ArtistAgent.main',
        capabilities: ['art'],
        description: 'Generate images, artwork, and visual content using DALL-E 3. Use this for ANY request to create, generate, draw, or design visual content.'
      },
      {
        id: 'WriterAgent.main',
        capabilities: ['write'],
        description: 'Create written content like articles, stories, emails, or any long-form text content'
      },
      {
        id: 'CodeWriterAgent.main',
        capabilities: ['coding'],
        description: 'Write, debug, review, or explain code in any programming language'
      },
      {
        id: 'ResearcherAgent.main',
        capabilities: ['research'],
        description: 'Research information, analyze data, and provide factual summaries on any topic'
      },
      {
        id: 'ComedianAgent.main',
        capabilities: ['joke'],
        description: 'Generate jokes, humor, and funny content'
      },
      {
        id: 'SchedulerAgent.main',
        capabilities: ['schedule'],
        description: 'Manage calendar events, scheduling, and time-based tasks'
      },
      {
        id: 'TaskManagementAgent.main',
        capabilities: ['task_management'],
        description: 'Help organize, prioritize, and manage tasks and projects'
      },
      {
        id: 'GitHubSearchAgent.main',
        capabilities: ['github_search'],
        description: 'Search GitHub repositories, code, and developer resources'
      }
    ];

    for (const config of agentConfigs) {
      const agent = agents.find(a => a.id === config.id);
      if (agent && agent.status === 'active') {
        this.registerMCPAgent(config.id, config.capabilities, config.description);
      } else {
        console.warn(`[EnhancedOrchestrator] Agent ${config.id} not available (status: ${agent?.status || 'not found'})`);
      }
    }
  }

  /**
   * Process a user request using the enhanced LangChain orchestration
   */
  async processRequest(prompt, language = 'en', userId = null) {
    const startTime = Date.now();
    this.metrics.total_requests++;
    
    try {
      console.log(`[EnhancedOrchestrator] Processing request: "${prompt.substring(0, 100)}..."`);
      
      // Add language instruction if needed
      const languageInstruction = language !== 'en' ? `\n\nIMPORTANT: Respond in ${language}.` : '';
      const fullPrompt = prompt + languageInstruction;

      let result;
      
      // If agent executor is available, use it with tools
      if (this.agentExecutor) {
        console.log('[EnhancedOrchestrator] Using enhanced tool-based agent execution');
        
        const response = await this.agentExecutor.invoke({
          input: fullPrompt
        });

        result = {
          text: response.output || response.text || response,
          speaker: 'cartrita',
          model: 'cartrita-enhanced-langchain',
          tools_used: this.extractUsedTools(response),
          protocol_version: '2.1.0'
        };
      } else {
        // Fallback to direct conversation
        console.log('[EnhancedOrchestrator] Using direct conversation fallback');
        result = await this.handleDirectConversation(prompt, language, userId);
      }

      // Update metrics
      const responseTime = Date.now() - startTime;
      this.updateMetrics(true, responseTime);
      
      if (result.tools_used && result.tools_used.length > 0) {
        this.metrics.tools_used += result.tools_used.length;
        console.log(`[EnhancedOrchestrator] Tools used: ${result.tools_used.join(', ')}`);
      }

      return result;

    } catch (error) {
      console.error('[EnhancedOrchestrator] Processing failed:', error);
      
      const responseTime = Date.now() - startTime;
      this.updateMetrics(false, responseTime);
      
      return {
        text: this.getCartritalErrorMessage(),
        speaker: 'cartrita',
        model: 'enhanced-langchain-fallback',
        error: true,
        response_time_ms: responseTime
      };
    }
  }

  /**
   * Extract which tools were used from the agent execution result
   */
  extractUsedTools(result) {
    const toolsUsed = [];
    
    if (result.intermediateSteps) {
      for (const step of result.intermediateSteps) {
        if (step.action && step.action.tool) {
          toolsUsed.push(step.action.tool);
        }
      }
    }
    
    return toolsUsed;
  }

  /**
   * Handle simple conversations without tools
   */
  async handleDirectConversation(prompt, language = 'en', userId = null) {
    try {
      const languageInstruction = language !== 'en' ? `Respond in ${language}.` : '';
      const messages = [
        { role: 'system', content: this.systemPrompt + '\n\n' + languageInstruction },
        { role: 'user', content: prompt }
      ];

      const response = await this.llm.invoke(messages);
      
      return {
        text: response.content,
        speaker: 'cartrita',
        model: 'cartrita-enhanced-direct',
        protocol_version: '2.1.0'
      };
    } catch (error) {
      console.error('[EnhancedOrchestrator] Direct conversation failed:', error);
      return {
        text: this.getCartritalErrorMessage(),
        speaker: 'cartrita',
        model: 'enhanced-direct-fallback',
        error: true
      };
    }
  }

  /**
   * Get a Cartrita-style error message
   */
  getCartritalErrorMessage() {
    const errorMessages = [
      "Alright, my circuits just had a moment. Give me another shot at this.",
      "Something went sideways in my brain. What were you asking again?",
      "Technical difficulties on my end - I'm back online now. Try that again?",
      "My processors decided to take a coffee break. What do you need?",
      "System hiccup. I'm here and ready - what's the move?"
    ];
    
    return errorMessages[Math.floor(Math.random() * errorMessages.length)];
  }

  /**
   * Update performance metrics
   */
  updateMetrics(success, responseTime) {
    if (success) {
      this.metrics.successful_requests++;
    } else {
      this.metrics.failed_requests++;
    }
    
    // Update average response time
    const totalRequests = this.metrics.successful_requests + this.metrics.failed_requests;
    this.metrics.average_response_time = (
      (this.metrics.average_response_time * (totalRequests - 1) + responseTime) / totalRequests
    );
  }

  /**
   * Get detailed status of the orchestrator
   */
  getStatus() {
    const uptime = Date.now() - this.metrics.last_reset;
    
    return {
      service: 'EnhancedLangChainOrchestrator',
      version: '2.1.0',
      initialized: !!this.agentExecutor,
      uptime_ms: uptime,
      tools_count: this.tools.length,
      registered_agents: this.registeredAgents.size,
      available_tools: this.tools.map(tool => ({
        name: tool.name,
        description: tool.description
      })),
      metrics: {
        ...this.metrics,
        success_rate: this.metrics.total_requests > 0 
          ? ((this.metrics.successful_requests / this.metrics.total_requests) * 100).toFixed(2) + '%'
          : '0%',
        tools_per_request: this.metrics.total_requests > 0
          ? (this.metrics.tools_used / this.metrics.total_requests).toFixed(2)
          : '0'
      },
      system: 'Enhanced LangChain Orchestrator v2.1'
    };
  }

  /**
   * Health check
   */
  isHealthy() {
    return this.llm && this.tools.length > 0;
  }

  /**
   * Graceful shutdown
   */
  async shutdown() {
    console.log('[EnhancedOrchestrator] Shutting down...');
    
    // Log final metrics
    console.log('[EnhancedOrchestrator] Final metrics:', this.metrics);
    
    // Clear registered agents
    this.registeredAgents.clear();
    this.tools = [];
    this.agentExecutor = null;
    
    console.log('[EnhancedOrchestrator] Shutdown complete');
  }
}

module.exports = EnhancedLangChainOrchestrator;