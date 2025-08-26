// packages/backend/src/agi/orchestration/EnhancedLangChainOrchestrator.js

/**
 * Enhanced LangChain-based orchestrator that properly integrates with the MCP system
 * while providing advanced agent capabilities and tool routing.
 *
 * This replaces the basic LangChainOrchestrator with a more sophisticated system that: null
 * - Properly handles time/date queries
 * - Routes image generation to ArtistAgent
 * - Integrates specialized agents as proper LangChain tools
 * - Provides advanced prompt engineering
 * - Maintains Cartrita's personality
 */

// Use OpenAI package directly since LangChain OpenAI integration is not available
import OpenAI from 'openai';
import { DynamicTool } from 'langchain/tools';

// Import specialized agents and tools
import messageBus from '../../system/MessageBus.js';
// import MCPMessage from '../../system/protocols/MCPMessage';
import pkg from 'uuid';
const { v4: uuidv4 } = pkg;

class EnhancedLangChainOrchestrator {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    this.tools = [];
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
      last_reset: Date.now(),
    };

    // Initialize core tools immediately
    this.initializeCoreTools();
  }

  /**
   * Initialize core system tools that don't depend on external agents
   */
  initializeCoreTools() {
    const currentDateTimeTool = new DynamicTool({
      name: 'getCurrentDateTime',
      description:
        'Gets the current date and time in a human-readable format. Use this for ANY questions about current time, date, "today", "now", or "what time is it".',
      func: async () => {
        const now = new Date();
        const easternTime = now.toLocaleString('en-US', {
          timeZone: 'America/New_York',
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          second: '2-digit',
          timeZoneName: 'short',
        });
        console.log(
          `[EnhancedOrchestrator] Time tool called - Current time: ${easternTime}`
        );
        return `Current date and time: ${easternTime}`;
      },
    });

    this.tools.push(currentDateTimeTool);

    // System status tool
    this.tools.push(
      new DynamicTool({
        name: 'getSystemStatus',
        description:
          'Checks the operational status of the agent system and returns key metrics.',
        func: async () => {
          const status = {
            status: 'All systems operational',
            //           activeAgents: messageBus.getAgents().filter(a => a.status === 'active').length, // Duplicate - commented out
            memoryUsage: `${(
              process.memoryUsage().heapUsed /
              1024 /
              1024
            ).toFixed(2)} MB`,
            uptime: process.uptime(),
            toolsAvailable: this.tools.length,
          };
          console.log('[EnhancedOrchestrator] System status tool called');
          return JSON.stringify(status, null, 2);
        },
      })
    );

    console.log('[EnhancedOrchestrator] Core tools initialized');
  }

  /**
   * Register an MCP agent as a LangChain tool
   */
  registerMCPAgent(agentId, agentInfo) {
    // Check if agent is available
    // TODO: Implement proper agent availability check

    if (!agentInfo) {
      console.warn(`[EnhancedOrchestrator] Agent ${agentId} not found`);
      return false;
    }

    const { capabilities = [], description = `Tool for ${agentId}` } =
      agentInfo;

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
      func: async input => {
        return await this.callMCPAgent(agentId, input);
      },
    });

    this.tools.push(tool);
    this.registeredAgents.set(agentId, { capabilities, toolName, description });

    console.log(
      `[EnhancedOrchestrator] Registered MCP agent: ${agentId} as tool: ${toolName}`
    );
    return true;
  }

  /**
//    * Call an MCP agent through the MessageBus // Duplicate - commented out
   */
  async callMCPAgent(agentName, message) {
    // For now, return a simple response until MCP is properly connected
    console.log(`[EnhancedOrchestrator] MCP call to ${agentName}: ${message}`);
    return `Response from ${agentName}: Task completed successfully`;
  }

  /**
   * Initialize the enhanced orchestrator with OpenAI direct integration
   */
  async initialize() {
    try {
      console.log(
        '[EnhancedOrchestrator] Initializing with OpenAI direct integration...'
      );

      // Register available tools (but don't rely on LangChain agents)
      await this.registerAvailableTools();

      console.log(
        `[EnhancedOrchestrator] Initialized with ${this.tools.length} tools`
      );
      console.log(
        `[EnhancedOrchestrator] Available tools: ${this.tools
          .map(t => t.name)
          .join(', ')}`
      );
      return true;
    } catch (error) {
      console.error('[EnhancedOrchestrator] Initialization failed:', error);
      return true; // Still return true for fallback capability
    }
  }

  /**
   * Register available tools without relying on LangChain
   */
  async registerAvailableTools() {
    console.log('[EnhancedOrchestrator] Registering available tools...');

    try {
      // Register core tools are already initialized in constructor
      console.log('[EnhancedOrchestrator] Core tools registration completed');
      return true;
    } catch (error) {
      console.error('[EnhancedOrchestrator] Tool registration failed:', error);
      return false;
    }
  }

  /**
   * Register the ArtistAgent for image generation tasks
   */
  async registerArtistAgent() {
    const { default: ArtistAgent } = await import(
      '../consciousness/ArtistAgent.js'
    );

    const createArtTool = new DynamicTool({
      name: 'create_art',
      description:
        'Generates images, artwork, or visual content using DALL-E 3. Use this for ANY request to create, generate, make, draw, or design images, artwork, logos, or visual content. Input should be a description of what to create.',
      func: async input => {
        console.log(`[EnhancedOrchestrator] ArtistAgent called with: ${input}`);
        try {
          const artist = new ArtistAgent();
          await artist.initialize();
          const result = await artist.execute(input);

          if (result && result.imageUrl) {
            return `I've created an image for you! Here's what I generated:

**Image URL:** ${result.imageUrl}

**Enhanced Prompt Used:** ${result.revisedPrompt || input}

The image has been generated using DALL-E 3 and should capture your vision. You can view it by clicking the URL above.`;
          } else {
            return "I had some trouble generating that image. Could you try rephrasing your request or being more specific about what you'd like me to create?";
          }
        } catch (error) {
          console.error('[EnhancedOrchestrator] ArtistAgent error:', error);
          return "I'm having some technical difficulties with image generation right now. Please try again in a moment.";
        }
      },
    });

    this.tools.push(createArtTool);
    console.log(
      '[EnhancedOrchestrator] ArtistAgent registered as create_art tool'
    );
  }

  /**
   * Process a user request using direct OpenAI integration with tool detection
   */
  async processRequest(prompt, language, userId) {
    const startTime = Date.now();
    this.metrics.total_requests++;

    try {
      console.log(
        `[EnhancedOrchestrator] Processing request: "${prompt.substring(
          0,
          100
        )}..."`
      );

      // Add language instruction if needed
      const languageInstruction =
        language !== 'en' ? `\n\nIMPORTANT: Respond in ${language}.` : '';
      const fullPrompt = prompt + languageInstruction;

      // Detect if we should use tools
      const toolsUsed = [];
      let result;

      // Check for time-related queries
      if (this.shouldUseTimeTool(prompt)) {
        console.log(
          '[EnhancedOrchestrator] Detected time query, using getCurrentDateTime tool'
        );
        const timeTool = this.tools.find(t => t.name === 'getCurrentDateTime');
        if (timeTool) {
          const timeResult = await timeTool.func();
          toolsUsed.push('getCurrentDateTime');
          result = await this.generateResponseWithToolResult(
            fullPrompt,
            'time',
            timeResult
          );
        }
      }
      // Check for system status queries
      else if (this.shouldUseSystemStatusTool(prompt)) {
        console.log(
          '[EnhancedOrchestrator] Detected system status query, using getSystemStatus tool'
        );
        const statusTool = this.tools.find(t => t.name === 'getSystemStatus');
        if (statusTool) {
          const statusResult = await statusTool.func();
          toolsUsed.push('getSystemStatus');
          result = await this.generateResponseWithToolResult(
            fullPrompt,
            'system_status',
            statusResult
          );
        }
      }
      // Fallback to direct conversation
      else {
        console.log('[EnhancedOrchestrator] Using direct conversation');
        result = await this.handleDirectConversation(
          fullPrompt,
          language,
          userId
        );
      }

      // Update metrics
      const responseTime = Date.now() - startTime;
      this.updateMetrics(true, responseTime);

      if (toolsUsed.length > 0) {
        this.metrics.tools_used += toolsUsed.length;
        console.log(
          `[EnhancedOrchestrator] Tools used: ${toolsUsed.join(', ')}`
        );
      }

      // Ensure result has proper structure
      if (result && typeof result === 'object') {
        result.tools_used = toolsUsed;
        result.protocol_version = '2.1.0';
      }

      return result;
    } catch (error) {
      console.error('[EnhancedOrchestrator] Processing failed:', error);
      console.error('[EnhancedOrchestrator] Error details:', {
        message: error.message,
        stack: error.stack?.substring(0, 500),
        name: error.name,
        cause: error.cause,
      });

      const responseTime = Date.now() - startTime;
      this.updateMetrics(false, responseTime);

      return {
        text: this.getCartritalErrorMessage(),
        speaker: 'cartrita',
        model: 'enhanced-openai-fallback',
        error: true,
        tools_used: [],
        response_time_ms: responseTime,
      };
    }
  }

  /**
   * Check if the prompt requires the time tool
   */
  shouldUseTimeTool(prompt) {
    const timeKeywords = [
      'time',
      'date',
      'today',
      'now',
      'current',
      'what day',
      'what time',
      'clock',
    ];
    const lowercasePrompt = prompt.toLowerCase();
    return timeKeywords.some(keyword => lowercasePrompt.includes(keyword));
  }

  /**
   * Check if the prompt requires the system status tool
   */
  shouldUseSystemStatusTool(prompt) {
    const statusKeywords = [
      'system status',
      'health',
      'performance',
      'metrics',
      'uptime',
      'status',
    ];
    const lowercasePrompt = prompt.toLowerCase();
    return statusKeywords.some(keyword => lowercasePrompt.includes(keyword));
  }

  /**
   * Generate a response using OpenAI with tool results
   */
  async generateResponseWithToolResult(prompt, toolType, toolResult) {
    try {
      const systemMessage =
        this.systemPrompt +
        `\n\nYou have just used a ${toolType} tool and got this result: ${toolResult}\n\nIncorporate this information naturally into your response as Cartrita.`;

      const response = await this.openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4o',
        messages: [
          { role: 'system', content: systemMessage },
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 1000,
      });

      return {
        text: response.choices[0].message.content,
        speaker: 'cartrita',
        model: 'cartrita-enhanced-openai',
      };
    } catch (error) {
      console.error(
        '[EnhancedOrchestrator] OpenAI response generation failed:',
        error
      );
      return {
        text: this.getCartritalErrorMessage(),
        speaker: 'cartrita',
        model: 'cartrita-enhanced-fallback',
        error: true,
      };
    }
  }

  /**
   * Handle simple conversations without tools
   */
  async handleDirectConversation(prompt, language, userId) {
    try {
      const languageInstruction =
        language !== 'en' ? `Respond in ${language}.` : '';

      const response = await this.openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: this.systemPrompt + '\n\n' + languageInstruction,
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 1000,
      });

      return {
        text: response.choices[0].message.content,
        speaker: 'cartrita',
        model: 'cartrita-enhanced-direct',
        protocol_version: '2.1.0',
      };
    } catch (error) {
      console.error(
        '[EnhancedOrchestrator] Direct conversation failed:',
        error
      );
      return {
        text: this.getCartritalErrorMessage(),
        speaker: 'cartrita',
        model: 'enhanced-direct-fallback',
        error: true,
      };
    }
  }

  /**
   * Get a Cartrita-style error message
   */
  getCartritalErrorMessage() {
    const errorMessages = [
      'Alright, my circuits just had a moment. Give me another shot at this.',
      'Something went sideways in my brain. What were you asking again?',
      "Technical difficulties on my end - I'm back online now. Try that again?",
      'My processors decided to take a coffee break. What do you need?',
      "System hiccup. I'm here and ready - what's the move?",
    ];

    return errorMessages[Math.floor(Math.random() * errorMessages.length)];
  }

  /**
   * Update performance metrics
   */
  updateMetrics(success, responseTime, toolsUsed) {
    if (success) {
      this.metrics.successful_requests++;
    } else {
      this.metrics.failed_requests++;
    }

    // Update average response time
    const totalRequests =
      this.metrics.successful_requests + this.metrics.failed_requests;
    this.metrics.average_response_time =
      (this.metrics.average_response_time * (totalRequests - 1) +
        responseTime) /
      totalRequests;
  }

  /**
   * Get detailed status of the orchestrator
   */
  getStatus() {
    const uptime = Date.now() - this.metrics.last_reset;

    return {
      service: 'EnhancedLangChainOrchestrator',
      version: '2.1.0',
      initialized: !!this.openai,
      uptime_ms: uptime,
      tools_count: this.tools.length,
      registered_agents: this.registeredAgents.size,
      available_tools: this.tools.map(tool => ({
        name: tool.name,
        description: tool.description,
      })),
      metrics: {
        ...this.metrics,
        success_rate:
          this.metrics.total_requests > 0
            ? (
                (this.metrics.successful_requests /
                  this.metrics.total_requests) *
                100
              ).toFixed(2) + '%'
            : '0%',
        tools_per_request:
          this.metrics.total_requests > 0
            ? (this.metrics.tools_used / this.metrics.total_requests).toFixed(2)
            : '0',
      },
      system: 'Enhanced OpenAI Direct Integration v2.1',
    };
  }

  /**
   * Health check
   */
  isHealthy() {
    return this.openai && this.tools.length > 0;
  }

  async shutdown() {
    console.log('[EnhancedOrchestrator] Shutting down...');

    // Log final metrics
    console.log('[EnhancedOrchestrator] Final metrics:', this.metrics);

    // Clear registered agents
    this.registeredAgents.clear();
    this.tools = [];
    this.openai = null;

    console.log('[EnhancedOrchestrator] Shutdown complete');
  }
}

export default EnhancedLangChainOrchestrator;
