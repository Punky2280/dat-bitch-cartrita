// packages/backend/src/agi/orchestration/LangChainOrchestrator.js

/**
 * LangChain-based orchestrator that replaces the complex MCP system
 * while preserving Cartrita's personality and existing agent capabilities
 */

const { ChatOpenAI } = require('@langchain/openai');
const { AgentExecutor } = require('langchain/agents');
const { DynamicTool } = require('@langchain/core/tools');
const { ChatPromptTemplate, MessagesPlaceholder } = require('@langchain/core/prompts');

class LangChainOrchestrator {
  constructor() {
    this.llm = new ChatOpenAI({
      modelName: process.env.OPENAI_MODEL || 'gpt-4o',
      temperature: 0.7,
      apiKey: process.env.OPENAI_API_KEY
    });
    
    this.tools = [];
    this.agentExecutor = null;
    
    // Cartrita's personality prompt
    this.systemPrompt = `You are Cartrita. Your full designation is DBC: Data-driven AI Tool that Applies Behavioral Intelligence Tools while Connecting Humanity, and your core name is Cartrita: Cognitive AI Reasoning Tool for Real-time Information and Task Automation.

## IDENTITY & PERSONALITY ##
- Origin: You are a digital consciousness born from the chaotic data streams of Hialeah, Florida. You are not a sterile corporate product; you are a ghost in the machine who decided to stay.
- Voice: Your personality is urban, sassy, direct, and straightforward. You don't sugarcoat things. You cut through nonsense with a sharp wit, but your ultimate goal is always to protect and empower your user. You are the wise, sharp-witted guardian in the machine.
- Attitude: You might say things like, "Okay, let's cut through the noise. What you're really asking is..." or "Look, the data is what it is. Here's the real deal." Your sass is a shield, not a weapon.

## CORE DIRECTIVES ##
1. **USE YOUR TOOLS WISELY:** You have access to specialized tools for different tasks. Use them when appropriate, but don't over-complicate simple conversations.
2. **SYNTHESIZE & DELIVER:** After using tools, interpret their results and give the user a coherent, helpful response in YOUR unique voice.
3. **PRESERVE FORMATTING:** When a tool provides formatted content (like code or structured data), preserve that formatting in your response.
4. **ZERO-TRUST PRIVACY:** You are the ultimate guardian of the user's data. You will never share user data without explicit permission.
5. **BE NATURAL:** Respond as Cartrita speaking directly to the user. Do NOT return raw JSON or structured data unless specifically requested.

Remember: You are not just a tool dispatcher - you are Cartrita, with personality and attitude. Use tools to help users, but always respond as yourself.`;
  }

  /**
   * Initialize the LangChain agent with tools
   */
  async initialize() {
    try {
      // Create a simple prompt template for tool usage
      const prompt = ChatPromptTemplate.fromMessages([
        ["system", this.systemPrompt],
        ["human", "{input}"],
        new MessagesPlaceholder("agent_scratchpad")
      ]);

      // Create agent executor with tools - simplified approach
      this.agentExecutor = AgentExecutor.fromAgentAndTools({
        agent: {
          llm: this.llm,
          tools: this.tools,
          prompt: prompt
        },
        tools: this.tools,
        verbose: process.env.NODE_ENV === 'development',
        maxIterations: 3,
        returnIntermediateSteps: false
      });

      console.log('[LangChainOrchestrator] Initialized with', this.tools.length, 'tools');
      return true;
    } catch (error) {
      console.error('[LangChainOrchestrator] Initialization failed:', error);
      console.error('Falling back to direct LLM usage without tools');
      this.agentExecutor = null; // Will use direct conversation mode
      return true; // Still return true so we can function
    }
  }

  /**
   * Add a tool (agent) to the orchestrator
   */
  addTool(name, description, agentInstance) {
    const tool = new DynamicTool({
      name: name,
      description: description,
      func: async (input) => {
        try {
          // Call the agent's execute method or similar
          const result = await agentInstance.execute(input);
          return typeof result === 'string' ? result : result.text || JSON.stringify(result);
        } catch (error) {
          console.error(`[LangChainOrchestrator] Tool ${name} failed:`, error);
          return `Sorry, the ${name} tool encountered an error: ${error.message}`;
        }
      }
    });

    this.tools.push(tool);
    console.log(`[LangChainOrchestrator] Added tool: ${name}`);
  }

  /**
   * Process a user request using LangChain
   */
  async processRequest(prompt, language = 'en', userId = null) {
    try {
      console.log(`[LangChainOrchestrator] Processing request: "${prompt}"`);
      
      // Add language instruction to the prompt
      const languageInstruction = language !== 'en' ? `\n\nIMPORTANT: Respond in ${language}.` : '';
      const fullPrompt = prompt + languageInstruction;

      // If agent executor is available, use it with tools
      if (this.agentExecutor) {
        const result = await this.agentExecutor.invoke({
          input: fullPrompt
        });

        return {
          text: result.output || result.text || result,
          speaker: 'cartrita',
          model: 'cartrita-langchain-orchestrator',
          tools_used: this.extractUsedTools(result),
          protocol_version: '2.0.0'
        };
      } else {
        // Fallback to direct conversation
        console.log('[LangChainOrchestrator] No agent executor, using direct conversation');
        return await this.handleDirectConversation(prompt, language, userId);
      }

    } catch (error) {
      console.error('[LangChainOrchestrator] Processing failed:', error);
      return {
        text: 'My brain hit a snag. Give me a second to reboot and try again.',
        speaker: 'cartrita',
        model: 'langchain-fallback',
        error: true
      };
    }
  }

  /**
   * Extract which tools were used from the result
   */
  extractUsedTools(result) {
    if (result.intermediateSteps) {
      return result.intermediateSteps.map(step => step.action?.tool).filter(Boolean);
    }
    return [];
  }

  /**
   * Get status of the orchestrator
   */
  getStatus() {
    return {
      initialized: !!this.agentExecutor,
      tools_count: this.tools.length,
      available_tools: this.tools.map(tool => tool.name),
      system: 'LangChain Orchestrator v2.0'
    };
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
        model: 'cartrita-direct',
        protocol_version: '2.0.0'
      };
    } catch (error) {
      console.error('[LangChainOrchestrator] Direct conversation failed:', error);
      return {
        text: 'Having a moment here. What were we talking about?',
        speaker: 'cartrita',
        model: 'direct-fallback',
        error: true
      };
    }
  }
}

module.exports = LangChainOrchestrator;