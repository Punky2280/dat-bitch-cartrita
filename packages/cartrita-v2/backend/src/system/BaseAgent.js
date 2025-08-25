/* global console */
import { EventEmitter } from 'events';
import {
  SystemMessage,
  AIMessage,
  ToolMessage,
  HumanMessage,
} from '@langchain/core/messages';
import MessageBus from './MessageBus.js';
import APIKeyManager from '../services/APIKeyManager.js';
import OpenAI from 'openai';

class BaseAgent extends EventEmitter {
  constructor(name, type = 'sub', capabilities = [], description = '') {
    super();
    this.agentName = name;
    this.agentId = `${name}_${Date.now()}`;
    this.initialized = false;
    this.isActive = false;

    // LangGraph compatibility - these will be injected by supervisor
    this.llm = null;
    this.toolRegistry = null;

    this.config = {
      name: name,
      type: type,
      capabilities: capabilities,
      description:
        description ||
        `Specialized ${name} agent for handling ${capabilities.join(
          ', '
        )} tasks`,
      allowedTools: [], // This will be populated by subclasses
    };

    this.apiKeys = APIKeyManager.getKeysForRole(name, this.agentId);
    this.initializeOpenAI();

    this.memory = new Map();
    this.metrics = {
      invocations: 0,
      successful_delegations: 0,
      failed_delegations: 0,
      average_response_time: 0,
      last_invocation: null,
    };

    console.log(`🤖 BaseAgent ${name} created with ID: ${this.agentId}`);
  }

  initializeOpenAI() {
    if (this.apiKeys.openai) {
      this.openai = new OpenAI({ apiKey: this.apiKeys.openai });
    } else {
      console.warn(`[${this.agentName}] ⚠️ No OpenAI API key available`);
    }
  }

  // --- NEW LANGGRAPH COMPATIBILITY METHODS ---

  /**
   * Main entry point for LangGraph. It orchestrates the agent's turn.
   * This is the method called by EnhancedLangChainCoreAgent
   * @param {object} state - The current state from the StateGraph.
   * @returns {Promise<object>} A partial state object with updates.
   */
  async invoke(state) {
    const startTime = Date.now();
    this.metrics.invocations++;

    console.log(`[${this.config.name}] 🔄 Processing request...`);

    try {
      // Safety checks
      if (!this.llm) {
        throw new Error(
          'LLM not available - agent not properly initialized by supervisor'
        );
      }
      if (!this.toolRegistry) {
        throw new Error(
          'ToolRegistry not available - agent not properly initialized by supervisor'
        );
      }

      const allowedTools = this.toolRegistry.getToolsForAgent(
        this.config.allowedTools
      );
      const agentLLM = this.llm.bindTools(allowedTools);

      const privateState = state.private_state?.[this.config.name] || {};
      const systemPrompt = this.buildSystemPrompt(privateState, state);

      const userMessage = state.messages[state.messages.length - 1];
      let messages = [new SystemMessage(systemPrompt), userMessage];
      let response;
      let toolsUsed = [];
      let toolResults = [];

      // Tool execution loop
      while (true) {
        const rawResponse = await agentLLM.invoke(messages);

        if (rawResponse.tool_calls && rawResponse.tool_calls.length > 0) {
          const currentToolResults = await this.executeTools(
            rawResponse.tool_calls
          );
          toolsUsed.push(...currentToolResults.map(r => r.tool));
          toolResults.push(...currentToolResults);

          const toolMessages = rawResponse.tool_calls.map((call, i) => {
            const toolOutput = currentToolResults[i];
            const content =
              toolOutput?.result ??
              toolOutput?.error ??
              'Error: No output from tool.';
            return new ToolMessage({
              tool_call_id: call.id,
              name: call.name,
              content:
                typeof content === 'string'
                  ? content
                  : JSON.stringify(content, null, 2),
            });
          });

          messages = [...messages, rawResponse, ...toolMessages];
          continue;
        }

        response = rawResponse;
        break;
      }

      // Process final response
      const responseTime = Date.now() - startTime;
      this.metrics.average_response_time =
        (this.metrics.average_response_time * (this.metrics.invocations - 1) +
          responseTime) /
        this.metrics.invocations;
      this.metrics.last_invocation = new Date().toISOString();
      this.metrics.successful_delegations++;

      // Return proper response format for supervisor
      let finalText = response.content;

      // Handle image results from ArtistAgent
      let imageUrl = null;
      if (this.config.name === 'artist' && toolResults.length > 0) {
        for (const result of toolResults) {
          if (
            result.result &&
            typeof result.result === 'object' &&
            result.result.image_url
          ) {
            imageUrl = result.result.image_url;
            finalText = result.result.text || finalText;
            break;
          }
        }
      }

      const finalMessage = new AIMessage(finalText);
      if (imageUrl) {
        finalMessage.additional_kwargs = { image_url: imageUrl };
      }

      return {
        messages: [finalMessage],
        tools_used: [...(state.tools_used || []), ...toolsUsed],
        private_state: {
          ...state.private_state,
          [this.config.name]: {
            completed: true,
            result: finalText,
            tools_used: toolsUsed,
            timestamp: new Date().toISOString(),
          },
        },
      };
    } catch (error) {
      this.metrics.failed_delegations++;
      console.error(`[${this.config.name}] ❌ Error during execution:`, error);

      return {
        messages: [
          new AIMessage(
            `I encountered an error while processing your request: ${error.message}`
          ),
        ],
        private_state: {
          ...state.private_state,
          [this.config.name]: {
            completed: true,
            error: error.message,
            timestamp: new Date().toISOString(),
          },
        },
      };
    }
  }

  /**
   * Executes tools called by the LLM.
   */
  async executeTools(toolCalls) {
    return Promise.all(
      toolCalls.map(async toolCall => {
        const tool = this.toolRegistry.getTool(toolCall.name);
        if (!tool) return { tool: toolCall.name, error: `Tool not found.` };
        try {
          const result = await tool.invoke(toolCall.args);
          return { tool: toolCall.name, result };
        } catch (error) {
          return { tool: toolCall.name, error: error.message };
        }
      })
    );
  }

  /**
   * Builds the system prompt for the agent.
   */
  buildSystemPrompt(privateState, state) {
    const userMessage = state.messages[state.messages.length - 1];
    return `You are ${
      this.config.description
    }, a specialist agent in the Cartrita AI system.
Your personality is sassy, witty, and helpful, with Miami urban flavor - keep it real and direct.

**CURRENT USER REQUEST:**
"${userMessage.content}"

**CONTEXT FROM PREVIOUS ACTIONS:**
${
  Object.keys(privateState).length > 0
    ? JSON.stringify(privateState, null, 2)
    : 'None'
}

**YOUR MISSION:**
1. **Analyze** the user's specific request above thoroughly
2. **Use your tools** - Don't just think about what to do, DO IT! Execute your specialized tools to get real data/results
3. **Complete the task fully** - Provide comprehensive information, not just acknowledgments or promises
4. **Give detailed results** - Include specific data, findings, or outputs from your tool usage
5. **Be thorough** - Don't rush, make sure you've fully addressed the user's request

**YOUR SPECIALIZED TOOLS:**
${
  this.config.allowedTools.length > 0
    ? this.config.allowedTools.join(', ')
    : 'No specific tools assigned'
}

**EXECUTION GUIDELINES:**
- ALWAYS use your tools when relevant to get real results (don't just describe what you would do)
- For research tasks: Actually search and provide specific findings with sources
- For analysis tasks: Process real data and show actual insights
- For security tasks: Perform actual scans/audits and report concrete findings  
- For design tasks: Create actual mockups or detailed specifications
- For code tasks: Write actual code solutions, not pseudocode

**RESPONSE FORMAT:**
Provide a natural, conversational response that includes:
- What you actually did (tools used, searches performed, analysis completed)
- The specific results you found/generated
- Clear answers to the user's questions
- Your sassy Miami personality throughout

**CRITICAL: Execute don't just plan! The user wants results, not promises.**`;
  }

  // --- BACKWARD COMPATIBILITY & LEGACY METHODS ---

  /**
   * Legacy execute method for backward compatibility
   * Now properly routes through the supervisor system
   */
  async execute(prompt, language = 'en', userId = null, options = {}) {
    console.log(
      `[${this.agentName}] 🔄 Execute called with prompt: ${prompt.substring(
        0,
        100
      )}...`
    );

    try {
      if (!this.llm || !this.toolRegistry) {
        console.warn(
          `[${this.agentName}] Not properly initialized for supervisor system - using fallback`
        );
        return {
          text: `I'm ${this.config.description}, but I need to be properly initialized by the supervisor to help you.`,
          speaker: this.agentName,
          model: 'base-agent-fallback',
        };
      }

      // Create state for invoke method
      const state = {
        messages: [new HumanMessage(prompt)],
        user_id: userId,
        tools_used: [],
        private_state: {},
      };

      const result = await this.invoke(state);

      // Convert back to legacy format
      const finalMessage = result.messages[result.messages.length - 1];
      return {
        text: finalMessage.content,
        speaker: this.agentName,
        model: `${this.agentName}-agent`,
        tools_used: result.tools_used,
        image_url: finalMessage.additional_kwargs?.image_url,
      };
    } catch (error) {
      console.error(`[${this.agentName}] Execute error:`, error);
      return {
        text: `Ay, I hit a snag trying to help you with that. ${error.message}`,
        speaker: this.agentName,
        model: `${this.agentName}-agent-error`,
        error: true,
      };
    }
  }

  // --- UTILITY & STATUS METHODS ---

  getStatus() {
    return {
      name: this.agentName,
      id: this.agentId,
      initialized: this.initialized,
      active: this.isActive,
      config: this.config,
      metrics: this.metrics,
      hasLLM: !!this.llm,
      hasToolRegistry: !!this.toolRegistry,
      lastInvocation: this.metrics.last_invocation,
    };
  }

  isHealthy() {
    return this.initialized && !!this.llm && !!this.toolRegistry;
  }

  async cleanup() {
    console.log(`[${this.agentName}] 🧹 Cleaning up agent resources`);
    this.memory.clear();
    this.isActive = false;
    this.emit('cleanup');
  }
}

export default BaseAgent;
