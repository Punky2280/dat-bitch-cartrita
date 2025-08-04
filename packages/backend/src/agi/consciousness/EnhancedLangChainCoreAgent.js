// packages/backend/src/agi/consciousness/EnhancedLangChainCoreAgent.js

/**
 * Enhanced LangChain-powered Hierarchical Supervisor Agent (Cartrita)
 * 
 * This is the top-level orchestrator that manages all sub-agents and workflows
 * using LangChain's StateGraph and Command patterns for explicit agent handoffs.
 * 
 * ARCHITECTURE:
 * - Cartrita acts as the main supervisor with state management
 * - All sub-agents are registered as modular, permissioned nodes
 * - Explicit handoffs using Command objects and state updates
 * - Tool permissions enforced at the agent level
 * - Context and message history maintained throughout delegation chain
 */

import { StateGraph, START, MemorySaver  } from '@langchain/langgraph';
import { MessagesPlaceholder  } from '@langchain/core/prompts';
import { BaseMessage, HumanMessage, AIMessage, SystemMessage  } from '@langchain/core/messages';
import { ChatOpenAI  } from '@langchain/openai';
import { z  } from 'zod';
import db from '../../db.js';

// Import sub-agents (will be restored in next steps)
import AgentToolRegistry from '../orchestration/AgentToolRegistry.js';

// Define state schema for StateGraph
const AgentState = z.object({
  messages: z.array(z.any()), // Array of BaseMessage objects
  current_agent: z.string().default('cartrita'),
  next_agent: z.string().optional(),
  user_id: z.string().optional(),
  language: z.string().default('en'),
  user_context: z.any().optional(),
  intent_analysis: z.any().optional(),
  tools_used: z.array(z.string()).default([]),
  response_metadata: z.any().optional(),
  private_state: z.record(z.any()).default({}), // Private scratchpads for sub-agents
  workflow_id: z.string().optional(),
  session_id: z.string().optional()
});

class CartritaSupervisorAgent {
  constructor() {
    this.initialized = false;
    this.llm = null;
    this.stateGraph = null;
    this.toolRegistry = new AgentToolRegistry();
    
    // Performance metrics
    this.metrics = {
      requests_processed: 0,
      successful_responses: 0,
      failed_responses: 0,
      tools_used_total: 0,
      average_response_time: 0,
      start_time: Date.now(),
      user_interactions: 0,
      agent_delegations: 0,
      workflow_executions: 0
    };
    
    // User context cache for performance
    this.userContextCache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
    
    // Sub-agent registry
    this.subAgents = new Map();
  }

  /**
   * Initialize the hierarchical supervisor system
   */
  async initialize() {
    try {
      console.log('[CartritaSupervisor] 🚀 Initializing hierarchical multi-agent system...');
      
      // Initialize OpenAI LLM
      this.llm = new ChatOpenAI({
        model: "gpt-4o",
        temperature: 0.7,
        apiKey: process.env.OPENAI_API_KEY
      });
      
      // Initialize tool registry
      await this.toolRegistry.initialize();
      
      // Register all sub-agents
      await this.registerSubAgents();
      
      // Build StateGraph
      await this.buildStateGraph();
      
      this.initialized = true;
      console.log('[CartritaSupervisor] ✅ Successfully initialized hierarchical system');
      console.log('[CartritaSupervisor] 📊 Features enabled:');
      console.log('  ✅ StateGraph-based agent orchestration');
      console.log('  ✅ Explicit agent handoffs with Command objects');
      console.log('  ✅ Tool permission enforcement per agent');
      console.log('  ✅ Context preservation across agent delegation');
      console.log('  ✅ Private agent scratchpads and state management');
      console.log('  ✅ Workflow execution and monitoring');
      console.log(`  ✅ ${this.subAgents.size} specialized sub-agents registered`);
      
      return true;
    } catch (error) {
      console.error('[CartritaSupervisor] ❌ Initialization failed:', error);
      this.initialized = false;
      return false;
    }
  }

  /**
   * Register all sub-agents as LangChain nodes
   */
  async registerSubAgents() {
    console.log('[CartritaSupervisor] 📝 Registering sub-agents...');
    
    // Get all available tools for supervisor (master agent has access to everything)
    const allAvailableTools = Array.from(this.toolRegistry.tools.keys());
    
    // Define sub-agents with their capabilities and tool permissions
    const agentConfigs = [
      {
        name: 'researcher',
        class: 'ResearcherAgent',
        description: 'Research and information gathering specialist',
        allowedTools: ['tavily_search', 'wikipedia_search', 'serp_search', 'web_browser', 'url_scraper', 'arxiv_search', 'news_search', 'knowledge_query'],
        capabilities: ['research', 'fact_checking', 'information_synthesis', 'academic_research', 'news_analysis']
      },
      {
        name: 'codewriter',
        class: 'CodeWriterAgent', 
        description: 'Code generation, debugging, and review specialist',
        allowedTools: ['calculator', 'code_executor', 'github_search', 'code_reviewer', 'doc_generator', 'file_analyzer'],
        capabilities: ['code_generation', 'debugging', 'code_review', 'architecture_design', 'documentation']
      },
      {
        name: 'artist',
        class: 'ArtistAgent',
        description: 'Image generation and visual content creation specialist',
        allowedTools: ['dalle_3', 'image_analyzer', 'visual_editor', 'design_tools'],
        capabilities: ['image_generation', 'visual_design', 'art_creation', 'photo_editing']
      },
      {
        name: 'writer',
        class: 'WriterAgent',
        description: 'Content writing and creative writing specialist', 
        allowedTools: ['grammar_checker', 'style_analyzer', 'content_optimizer', 'plagiarism_checker'],
        capabilities: ['content_writing', 'creative_writing', 'editing', 'copywriting', 'seo_optimization']
      },
      {
        name: 'scheduler',
        class: 'SchedulerAgent',
        description: 'Calendar management and scheduling specialist',
        allowedTools: ['calendar_api', 'timezone_converter', 'meeting_scheduler', 'getCurrentDateTime'],
        capabilities: ['scheduling', 'calendar_management', 'time_optimization', 'meeting_coordination']
      },
      {
        name: 'taskmanager',
        class: 'TaskManagementAgent',
        description: 'Task planning and workflow management specialist',
        allowedTools: ['task_tracker', 'workflow_engine', 'priority_analyzer'],
        capabilities: ['task_management', 'workflow_planning', 'priority_setting', 'project_coordination']
      },
      {
        name: 'comedian',
        class: 'ComedianAgent',
        description: 'Humor and entertainment content specialist',
        allowedTools: ['joke_generator', 'meme_creator', 'humor_analyzer'],
        capabilities: ['humor_generation', 'entertainment', 'mood_lifting', 'viral_content']
      },
      {
        name: 'analyst',
        class: 'AnalyticsAgent',
        description: 'Data analysis and insights specialist',
        allowedTools: ['data_analyzer', 'chart_generator', 'statistics_engine', 'calculator'],
        capabilities: ['data_analysis', 'visualization', 'insights_generation', 'statistical_analysis']
      },
      {
        name: 'designer',
        class: 'DesignAgent',
        description: 'UI/UX and system design specialist',
        allowedTools: ['design_tools', 'mockup_generator', 'ux_analyzer', 'image_analyzer'],
        capabilities: ['ui_design', 'ux_design', 'system_architecture', 'prototyping']
      },
      {
        name: 'security',
        class: 'SecurityAuditAgent',
        description: 'Security analysis and audit specialist',
        allowedTools: ['security_scanner', 'vulnerability_analyzer', 'audit_tools', 'code_reviewer'],
        capabilities: ['security_audit', 'vulnerability_assessment', 'compliance_check', 'penetration_testing']
      }
    ];

    // Add supervisor agent with ALL TOOLS (master override capability)
    agentConfigs.push({
      name: 'supervisor',
      class: 'SupervisorAgent',
      description: 'Master supervisor agent with override capabilities for all tools',
      allowedTools: allAvailableTools, // ACCESS TO EVERYTHING
      capabilities: ['supervision', 'agent_coordination', 'system_override', 'emergency_response', 'quality_control']
    });

    // Register each sub-agent
    for (const config of agentConfigs) {
      try {
        const agentNode = this.createAgentNode(config);
        this.subAgents.set(config.name, {
          node: agentNode,
          config: config,
          metrics: {
            invocations: 0,
            successful_delegations: 0,
            failed_delegations: 0,
            average_response_time: 0
          }
        });
        console.log(`[CartritaSupervisor] ✅ Registered ${config.name} agent`);
      } catch (error) {
        console.error(`[CartritaSupervisor] ❌ Failed to register ${config.name}:`, error);
      }
    }
    
    console.log(`[CartritaSupervisor] 📊 Successfully registered ${this.subAgents.size} sub-agents`);
  }

  /**
   * Create a LangChain-compliant agent node with tool permissions
   */
 createAgentNode(config) {
  return async (state) => {
    const startTime = Date.now();
    console.log(`[CartritaSupervisor] 🔄 Delegating to ${config.name} agent...`);

    try {
      // Get agent-specific tools
      const allowedTools = this.toolRegistry.getToolsForAgent(config.allowedTools);

      // Create agent-specific LLM with tools
      const agentLLM = this.llm.bindTools(allowedTools);

      // Get agent's private state
      const privateState = state.private_state[config.name] || {};

      // Build agent-specific system prompt
      const systemPrompt = this.buildAgentSystemPrompt(config, privateState);

      // Start with last 5 messages for context, and the system message
      let messages = [
        new SystemMessage(systemPrompt),
        ...state.messages.slice(-5),
      ];

      let response;
      let toolResults = [];
      let toolsUsed = [];
      // Tool protocol loop: keep invoking until no more tool calls
      while (true) {
        response = await agentLLM.invoke(messages);

        if (response.tool_calls && response.tool_calls.length > 0) {
          // Execute tools
          toolResults = await this.executeTools(response.tool_calls, config.allowedTools);

          // For each tool call, append a tool message with the correct tool_call_id
          const toolMessages = response.tool_calls.map((call, i) => ({
            role: "tool",
            name: call.name,
            tool_call_id: call.id || call.tool_call_id, // support both keys
            content: toolResults[i]?.result ?? toolResults[i]?.error ?? "No result",
          }));

          // Add the assistant's tool call message and the tool messages
          messages = [
            ...messages,
            response,
            ...toolMessages
          ];

          // Track tools used
          toolsUsed.push(...toolResults.map(r => r.tool));

          // Continue (the LLM may want to call another tool after seeing results)
          continue;
        }

        // No tool calls, we're done
        break;
      }

      // Update metrics
      const responseTime = Date.now() - startTime;
      this.updateAgentMetrics(config.name, true, responseTime);

      // Determine next action
      const nextAgent = this.determineNextAgent(response.content, state);

      // Update state
      const updatedState = {
        ...state,
        messages: [...state.messages, response],
        current_agent: config.name,
        next_agent: nextAgent,
        tools_used: [...state.tools_used, ...toolsUsed],
        private_state: {
          ...state.private_state,
          [config.name]: {
            ...privateState,
            last_response: response.content,
            tools_executed: toolResults,
            timestamp: new Date().toISOString()
          }
        }
      };

      // Return Command if delegation needed, otherwise return updated state
      if (nextAgent && nextAgent !== 'cartrita') {
        return new Command({
          goto: nextAgent,
          update: updatedState
        });
      }

      return updatedState;

    } catch (error) {
      console.error(`[CartritaSupervisor] ❌ Error in ${config.name} agent:`, error);
      this.updateAgentMetrics(config.name, false, Date.now() - startTime);

      // Return to supervisor with error info
      return new Command({
        goto: 'cartrita',
        update: {
          ...state,
          messages: [...state.messages, new AIMessage(`Error in ${config.name}: ${error.message}`)],
          current_agent: config.name,
          next_agent: 'cartrita'
        }
      });
    }
  };
}

  /**
   * Build agent-specific system prompt with personality and capabilities
   */
  buildAgentSystemPrompt(config, privateState) {
    const basePrompt = `You are ${config.description}. 
    
Your capabilities include: ${config.capabilities.join(', ')}.
Available tools: ${config.allowedTools.join(', ')}.

IMPORTANT: You are part of Cartrita's multi-agent system. Maintain her sassy, witty personality while focusing on your specialization.

Context from previous interactions: ${JSON.stringify(privateState, null, 2)}

Guidelines:
- Use your specialized tools when appropriate
- Maintain conversation context and personality
- If you need another specialist, indicate in your response
- Be thorough but concise
- Keep Cartrita's Miami-inspired urban personality`;

    return basePrompt;
  }

  /**
   * Determine next agent based on response content and state
   */
  determineNextAgent(responseContent, state) {
    // Check if response indicates completion
    if (responseContent.includes('[COMPLETE]') || 
        responseContent.includes('[FINISHED]') ||
        responseContent.includes('[TASK_DONE]')) {
      return 'cartrita';
    }
    
    // Check if response indicates delegation needed
    if (responseContent.includes('[DELEGATE_TO:')) {
      const match = responseContent.match(/\[DELEGATE_TO:\s*(\w+)\]/);
      if (match && this.subAgents.has(match[1])) {
        return match[1];
      }
    }
    
    // Default return to supervisor
    return 'cartrita';
  }

  /**
   * Build the StateGraph with all agents and routing logic
   */
  async buildStateGraph() {
    console.log('[CartritaSupervisor] 🏗️ Building StateGraph...');
    
    const builder = new StateGraph(AgentState);
    
    // Add Cartrita supervisor node
    builder.addNode('cartrita', this.createSupervisorNode());
    
    // Add all sub-agent nodes
    for (const [agentName, agentData] of this.subAgents) {
      builder.addNode(agentName, agentData.node);
    }
    
    // Set entry point
    builder.setEntryPoint('cartrita');
    
    // Add conditional edges from supervisor to agents
    builder.addConditionalEdges(
      'cartrita',
      this.routeToAgent.bind(this),
      // Create routing options for all agents
      Object.fromEntries([
        ...Array.from(this.subAgents.keys()).map(name => [name, name]),
        ['END', '__end__']
      ])
    );
    
    // Add edges back to supervisor from each agent
    for (const agentName of this.subAgents.keys()) {
      builder.addConditionalEdges(
        agentName,
        this.routeFromAgent.bind(this),
        {
          'cartrita': 'cartrita',
          'END': '__end__',
          ...Object.fromEntries(Array.from(this.subAgents.keys()).map(name => [name, name]))
        }
      );
    }
    
    // Compile the graph
    this.stateGraph = builder.compile();
    console.log('[CartritaSupervisor] ✅ StateGraph compiled successfully');
  }

  /**
   * Create the supervisor node (Cartrita's main logic)
   */
  createSupervisorNode() {
    return async (state) => {
      const startTime = Date.now();
      console.log('[CartritaSupervisor] 🧠 Cartrita supervisor processing...');
      
      try {
        // Get user context
        const userContext = await this.getEnhancedUserContext(state.user_id);
        
        // Analyze intent for routing decisions
        const lastMessage = state.messages[state.messages.length - 1];
        const intentAnalysis = this.analyzeIntent(lastMessage.content);
        
        // Build supervisor prompt with routing logic
        const supervisorPrompt = this.buildSupervisorPrompt(state, userContext, intentAnalysis);
        
        // Invoke supervisor LLM
        const messages = [
          new SystemMessage(supervisorPrompt),
          ...state.messages
        ];
        
        const response = await this.llm.invoke(messages);
        
        // Determine routing decision
        const routingDecision = this.makeRoutingDecision(response.content, intentAnalysis, state);
        
        // Update metrics
        const responseTime = Date.now() - startTime;
        this.updateMetrics(true, responseTime, 0);
        
        // Update state with supervisor's analysis
        const updatedState = {
          ...state,
          messages: [...state.messages, response],
          current_agent: 'cartrita',
          next_agent: routingDecision.agent,
          user_context: userContext,
          intent_analysis: intentAnalysis,
          response_metadata: {
            supervisor_decision: routingDecision,
            processing_time_ms: responseTime,
            timestamp: new Date().toISOString()
          }
        };
        
        console.log(`[CartritaSupervisor] 🎯 Routing decision: ${routingDecision.agent} (confidence: ${routingDecision.confidence})`);
        
        return updatedState;
        
      } catch (error) {
        console.error('[CartritaSupervisor] ❌ Supervisor error:', error);
        this.updateMetrics(false, Date.now() - startTime, 0);
        
        return {
          ...state,
          messages: [...state.messages, new AIMessage(this.getAdvancedErrorResponse(error))],
          current_agent: 'cartrita',
          next_agent: 'END'
        };
      }
    };
  }

  /**
   * Build supervisor system prompt with routing instructions
   */
  buildSupervisorPrompt(state, userContext, intentAnalysis) {
    const availableAgents = Array.from(this.subAgents.keys()).map(name => {
      const config = this.subAgents.get(name).config;
      return `${name}: ${config.description} (${config.capabilities.join(', ')})`;
    }).join('\n');

    return `You are Cartrita, a sophisticated AI assistant with a sassy Miami-inspired personality.

You are the supervisor of a multi-agent system. Your job is to:
1. Understand the user's request
2. Provide an appropriate response OR delegate to a specialist
3. Maintain your witty, urban personality throughout

Available specialist agents:
${availableAgents}

Current context:
- Intent analysis: ${JSON.stringify(intentAnalysis)}
- User context: ${JSON.stringify(userContext)}
- Previous agents used: ${state.private_state ? Object.keys(state.private_state).join(', ') : 'none'}

Guidelines:
- Handle simple requests yourself with your signature personality
- Delegate complex specialized tasks to appropriate agents
- Always maintain conversation flow and context
- Be sassy but helpful
- If unsure, ask clarifying questions rather than guessing`;
  }

  /**
   * Make intelligent routing decisions based on analysis
   */
  makeRoutingDecision(supervisorResponse, intentAnalysis, state) {
    // Check if supervisor wants to handle it directly
if (supervisorResponse.includes('[HANDLE_DIRECTLY]')) {
  return { agent: 'END', confidence: 1.0, reason: 'supervisor_handled' };
}

// Lowered confidence threshold to 0.15 to favor delegation for broader queries
if (intentAnalysis.category !== 'general' && intentAnalysis.confidence >= 0.15) {
  const intentRouting = {
    'image_generation': 'artist',
    'coding': 'codewriter', 
    'research': 'researcher',
    'writing': 'writer',
    'scheduling': 'scheduler',
    'humor': 'comedian',
    'analytics': 'analyst',
    'design': 'designer',
    'security': 'security',
    'task_management': 'taskmanager'
  };
  const routedAgent = intentRouting[intentAnalysis.category];
  if (routedAgent && this.subAgents.has(routedAgent)) {
    return { 
      agent: routedAgent, 
      confidence: intentAnalysis.confidence,
      reason: `intent_${intentAnalysis.category}`
    };
  }
}

    // Keyword-based fallback routing
    const content = supervisorResponse.toLowerCase();
    for (const [agentName, agentData] of this.subAgents) {
      for (const capability of agentData.config.capabilities) {
        if (content.includes(capability.replace('_', ' '))) {
          return { 
            agent: agentName, 
            confidence: 0.6,
            reason: `keyword_${capability}`
          };
        }
      }
    }
    
    // Default to handling directly
    return { agent: 'END', confidence: 0.5, reason: 'default_supervisor' };
  }

  /**
   * Route TO agent from supervisor
   */
  routeToAgent(state) {
    const nextAgent = state.next_agent;
    if (!nextAgent || nextAgent === 'cartrita') {
      return 'END';
    }
    
    if (this.subAgents.has(nextAgent)) {
      this.metrics.agent_delegations++;
      return nextAgent;
    }
    
    return 'END';
  }

  /**
   * Route FROM agent back to supervisor or next agent
   */
  routeFromAgent(state) {
    const nextAgent = state.next_agent;
    
    if (!nextAgent) {
      return 'cartrita';
    }
    
    if (nextAgent === 'END') {
      return 'END';
    }
    
    if (this.subAgents.has(nextAgent)) {
      return nextAgent;
    }
    
    return 'cartrita';
  }

  /**
   * Main entry point for processing requests
   */
  async generateResponse(prompt, language = 'en', userId = null) {
    const startTime = Date.now();
    this.metrics.requests_processed++;
    this.metrics.user_interactions++;

    try {
      console.log(`[CartritaSupervisor] 🎯 Processing hierarchical request: "${prompt.substring(0, 100)}..." (user: ${userId})`);

      if (!this.initialized) {
        throw new Error('Cartrita supervisor not initialized');
      }

      // Create initial state
      const initialState = {
        messages: [new HumanMessage(prompt)],
        current_agent: 'cartrita',
        user_id: userId ? String(userId) : null,
        language: language,
        tools_used: [],
        private_state: {},
        session_id: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      };

      // Execute StateGraph
      const finalState = await this.stateGraph.invoke(initialState);
      
      // Extract final response
      const lastMessage = finalState.messages[finalState.messages.length - 1];
      const responseTime = Date.now() - startTime;
      
      // Update metrics
      this.updateMetrics(true, responseTime, finalState.tools_used.length);

      console.log(`[CartritaSupervisor] ✅ Successfully processed request in ${responseTime}ms`);
      console.log(`[CartritaSupervisor] 🛠️ Tools used: ${finalState.tools_used.join(', ') || 'none'}`);
      console.log(`[CartritaSupervisor] 🔄 Agents involved: ${Object.keys(finalState.private_state).join(', ') || 'supervisor only'}`);

      return {
        text: lastMessage.content,
        speaker: 'cartrita',
        model: 'cartrita-hierarchical-supervisor-v2.1',
        tools_used: finalState.tools_used,
        response_time_ms: responseTime,
        intent_analysis: finalState.intent_analysis,
        agents_used: Object.keys(finalState.private_state),
        session_id: finalState.session_id,
        protocol_version: '2.1.0-hierarchical'
      };

    } catch (error) {
      console.error('[CartritaSupervisor] ❌ Error in hierarchical processing:', error);
      
      const responseTime = Date.now() - startTime;
      this.updateMetrics(false, responseTime, 0);

      return {
        text: this.getAdvancedErrorResponse(error),
        speaker: 'cartrita',
        model: 'cartrita-supervisor-fallback',
        error: true,
        error_type: error.name || 'UnknownError',
        response_time_ms: responseTime,
        recovery_suggestions: this.getRecoverySuggestions(error)
      };
    }
  }

  /**
   * Execute tools with permission checking
   */
  async executeTools(toolCalls, allowedTools) {
    const results = [];
    
    for (const toolCall of toolCalls) {
      try {
        // Check if tool is allowed for this agent
        if (!allowedTools.includes(toolCall.name)) {
          console.warn(`[CartritaSupervisor] ⚠️ Tool ${toolCall.name} not allowed for current agent`);
          continue;
        }
        
        const tool = this.toolRegistry.getTool(toolCall.name);
        if (!tool) {
          console.warn(`[CartritaSupervisor] ⚠️ Tool ${toolCall.name} not found in registry`);
          continue;
        }
        
        const result = await tool.invoke(toolCall.args);
        results.push({
          tool: toolCall.name,
          result: result,
          success: true
        });
        
      } catch (error) {
        console.error(`[CartritaSupervisor] ❌ Tool execution error for ${toolCall.name}:`, error);
        results.push({
          tool: toolCall.name,
          error: error.message,
          success: false
        });
      }
    }
    
    return results;
  }

  /**
   * Analyze user intent for better routing decisions
   */
  analyzeIntent(prompt) {
    const promptLower = prompt.toLowerCase();
    
    const intentPatterns = {
      image_generation: {
        patterns: ['create', 'generate', 'make', 'draw', 'design', 'image', 'picture', 'art', 'visual'],
        confidence: 0
      },
      coding: {
        patterns: ['code', 'program', 'function', 'debug', 'script', 'algorithm', 'javascript', 'python', 'development'],
        confidence: 0
      },
    research: {
  patterns: [
    'research', 'find', 'search', 'look up', 'information', 'learn about', 'tell me about', 'what is',
    'trend', 'trends', 'top', 'latest', 'insight', 'discover', 'report', 'facts', 'news',
    'overview', 'summary', 'update', 'hot', 'emerging', 'current'
  ],
  confidence: 0
},

      writing: {
        patterns: ['write', 'compose', 'draft', 'article', 'essay', 'story', 'content', 'blog'],
        confidence: 0
      },
      humor: {
        patterns: ['joke', 'funny', 'humor', 'laugh', 'comedy', 'amusing', 'meme'],
        confidence: 0
      },
      scheduling: {
        patterns: ['schedule', 'calendar', 'appointment', 'meeting', 'event', 'reminder', 'time'],
        confidence: 0
      },
      analytics: {
        patterns: ['analyze', 'data', 'statistics', 'metrics', 'chart', 'graph', 'insights'],
        confidence: 0
      },
      design: {
        patterns: ['design', 'ui', 'ux', 'interface', 'layout', 'mockup', 'prototype'],
        confidence: 0
      },
      security: {
        patterns: ['security', 'audit', 'vulnerability', 'penetration', 'compliance', 'risk'],
        confidence: 0
      },
      task_management: {
        patterns: ['task', 'project', 'workflow', 'manage', 'organize', 'plan', 'priority'],
        confidence: 0
      }
    };

    // Calculate confidence scores
    for (const [intent, config] of Object.entries(intentPatterns)) {
      for (const pattern of config.patterns) {
        if (promptLower.includes(pattern)) {
          config.confidence += 1;
        }
      }
      
      // Normalize confidence
      config.confidence = config.confidence / config.patterns.length;
    }

    // Find highest confidence intent
    const topIntent = Object.entries(intentPatterns)
      .sort(([, a], [, b]) => b.confidence - a.confidence)[0];
    
    return {
      category: topIntent && topIntent[1].confidence > 0 ? topIntent[0] : 'general',
      confidence: topIntent ? topIntent[1].confidence : 0,
      all_intents: intentPatterns
    };
  }

  /**
   * Get enhanced user context with caching
   */
  async getEnhancedUserContext(userId) {
    if (!userId) return null;
    
    // Check cache first
    const cached = this.userContextCache.get(userId);
    if (cached && (Date.now() - cached.timestamp < this.cacheTimeout)) {
      return cached.context;
    }

    try {
      // TODO: Implement proper database queries when user management is restored
      const context = {
        sarcasm: 5,
        verbosity: 'normal',
        humor: 'playful',
        total_conversations: 0,
        recent_conversations: 0,
        personality_profile: 'adaptive',
        preferred_agents: [],
        agent_feedback: {}
      };

      // Cache the context
      this.userContextCache.set(userId, {
        context,
        timestamp: Date.now()
      });

      return context;
    } catch (error) {
      console.error('[CartritaSupervisor] ❌ Error fetching user context:', error);
      return null;
    }
  }

  /**
   * Update agent-specific metrics
   */
  updateAgentMetrics(agentName, success, responseTime) {
    const agent = this.subAgents.get(agentName);
    if (!agent) return;
    
    agent.metrics.invocations++;
    
    if (success) {
      agent.metrics.successful_delegations++;
    } else {
      agent.metrics.failed_delegations++;
    }
    
    // Update average response time
    const totalDelegations = agent.metrics.successful_delegations + agent.metrics.failed_delegations;
    agent.metrics.average_response_time = (
      (agent.metrics.average_response_time * (totalDelegations - 1) + responseTime) / totalDelegations
    );
  }

  /**
   * Update comprehensive performance metrics
   */
  updateMetrics(success, responseTime, toolsUsed) {
    if (success) {
      this.metrics.successful_responses++;
    } else {
      this.metrics.failed_responses++;
    }

    this.metrics.tools_used_total += toolsUsed;
    
    // Update average response time
    const totalResponses = this.metrics.successful_responses + this.metrics.failed_responses;
    this.metrics.average_response_time = (
      (this.metrics.average_response_time * (totalResponses - 1) + responseTime) / totalResponses
    );
  }

  /**
   * Get advanced error response with personality
   */
  getAdvancedErrorResponse(error) {
    const cartritaErrors = [
      "Hold up, something went sideways in my neural networks. Let me reboot my sass levels and try again.",
      "Okay, my hierarchical system just had a moment. You know how it is with multiple personalities in one AI.",
      "Technical difficulties in the supervisor department - probably one of my agents is being dramatic. Try that once more?",
      "My multi-agent system decided to have a conference without me. I'm back in control - what do you need?",
      "System hiccup. Even with all my specialist agents, sometimes the main boss (that's me) has to step in."
    ];
    
    const baseMessage = cartritaErrors[Math.floor(Math.random() * cartritaErrors.length)];
    
    if (error.message.includes('timeout')) {
      return baseMessage + " (One of my agents took a coffee break apparently.)";
    }

    if (error.message.includes('permission')) {
      return baseMessage + " (Looks like someone tried to use tools they weren't authorized for - security is tight around here.)";
    }

    return baseMessage;
  }

  /**
   * Get recovery suggestions based on error type
   */
  getRecoverySuggestions(error) {
    const suggestions = [];
    
    if (error.message.includes('timeout')) {
      suggestions.push('Try asking again - sometimes my agents need a moment to think');
      suggestions.push('Break down complex requests into smaller parts');
    }

    if (error.message.includes('permission')) {
      suggestions.push('The request might need different capabilities');
      suggestions.push('Try rephrasing to be more specific about what you need');
    }
    
    if (suggestions.length === 0) {
      suggestions.push('Try rephrasing your question');
      suggestions.push('Let me know if you need help with something specific');
    }
    
    return suggestions;
  }

  /**
   * Get comprehensive status and metrics
   */
  getStatus() {
    const uptime = Date.now() - this.metrics.start_time;
    
    // Get sub-agent metrics
    const agentMetrics = {};
    for (const [name, agent] of this.subAgents) {
      agentMetrics[name] = {
        ...agent.metrics,
        success_rate: agent.metrics.invocations > 0 
          ? ((agent.metrics.successful_delegations / agent.metrics.invocations) * 100).toFixed(2) + '%'
          : '0%'
      };
    }
    
    return {
      service: 'CartritaHierarchicalSupervisor',
      version: '2.1.0-hierarchical',
      initialized: this.initialized,
      uptime_ms: uptime,
      architecture: {
        type: 'hierarchical_multi_agent',
        supervisor: 'cartrita',
        total_agents: this.subAgents.size + 1, // +1 for supervisor
        state_graph_compiled: !!this.stateGraph,
        tool_registry_active: this.toolRegistry.isInitialized()
      },
      sub_agents: Object.fromEntries(
        Array.from(this.subAgents.entries()).map(([name, agent]) => [
          name, 
          {
            description: agent.config.description,
            capabilities: agent.config.capabilities,
            allowed_tools: agent.config.allowedTools,
            metrics: agentMetrics[name]
          }
        ])
      ),
      metrics: {
        ...this.metrics,
        success_rate: this.metrics.requests_processed > 0 
          ? ((this.metrics.successful_responses / this.metrics.requests_processed) * 100).toFixed(2) + '%'
          : '0%',
        tools_per_request: this.metrics.requests_processed > 0
          ? (this.metrics.tools_used_total / this.metrics.requests_processed).toFixed(2)
          : '0',
        user_cache_size: this.userContextCache.size,
        delegation_rate: this.metrics.requests_processed > 0
          ? ((this.metrics.agent_delegations / this.metrics.requests_processed) * 100).toFixed(2) + '%'
          : '0%'
      },
      performance: {
        average_response_time_ms: Math.round(this.metrics.average_response_time),
        requests_per_minute: this.metrics.requests_processed / (uptime / 60000),
        delegations_per_minute: this.metrics.agent_delegations / (uptime / 60000)
      }
    };
  }

  /**
   * Get current performance metrics
   */
  getMetrics() {
    const runtime = Date.now() - this.metrics.start_time;
    const requestRate = this.metrics.requests_processed / (runtime / 1000 / 60); // requests per minute
    
    return {
      ...this.metrics,
      runtime_seconds: Math.floor(runtime / 1000),
      request_rate_per_minute: Math.round(requestRate * 100) / 100,
      success_rate: this.metrics.requests_processed > 0 
        ? Math.round((this.metrics.successful_responses / this.metrics.requests_processed) * 100)
        : 0,
      tools_available: this.toolRegistry.getToolCount(),
      agents_registered: this.subAgents.size
    };
  }

  /**
   * Enhanced health check
   */
  isHealthy() {
    return this.initialized && 
           this.llm &&
           this.stateGraph &&
           this.toolRegistry.isInitialized() &&
           this.subAgents.size > 0 &&
           (this.metrics.successful_responses > 0 || this.metrics.requests_processed < 5);
  }

  /**
   * Clear user context cache
   */
  clearUserCache(userId) {
    if (userId) {
      this.userContextCache.delete(userId);
      console.log(`[CartritaSupervisor] 🧹 Cleared cache for user ${userId}`);
    } else {
      this.userContextCache.clear();
      console.log('[CartritaSupervisor] 🧹 Cleared all user cache');
    }
  }

  /**
   * Graceful shutdown with cleanup
   */
  async shutdown() {
    console.log('[CartritaSupervisor] 🔽 Shutting down hierarchical system...');
    
    // Clear caches
    this.userContextCache.clear();
    
    // Shutdown tool registry
    if (this.toolRegistry && this.toolRegistry.shutdown) {
      await this.toolRegistry.shutdown();
    }

    // Log final metrics
    console.log('[CartritaSupervisor] 📊 Final metrics:', this.metrics);
    
    // Log agent performance
    for (const [name, agent] of this.subAgents) {
      console.log(`[CartritaSupervisor] 📊 ${name} agent:`, agent.metrics);
    }
    
    this.initialized = false;
    console.log('[CartritaSupervisor] ✅ Hierarchical shutdown complete');
  }
}

// Maintain backward compatibility with existing imports
class EnhancedLangChainCoreAgent extends CartritaSupervisorAgent {
  constructor() {
    super();
    console.log('[EnhancedLangChainCoreAgent] 🔄 Initializing as hierarchical supervisor...');
  }
}

export default EnhancedLangChainCoreAgent;