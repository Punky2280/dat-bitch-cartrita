import { StateGraph } from '@langchain/langgraph';
import {
  AIMessage,
  HumanMessage,
  SystemMessage,
} from '@langchain/core/messages';
import { ChatOpenAI } from '@langchain/openai';
import AgentToolRegistry from '../orchestration/AgentToolRegistry.js';
import OpenTelemetryTracing from '../../system/OpenTelemetryTracing.js';

// --- FIX: Removed all static agent imports from here to break circular dependencies. ---

const AgentState = {
  messages: { value: (x, y) => x.concat(y), default: () => [] },
  next_agent: String,
  user_id: String,
  private_state: { value: (x, y) => ({ ...x, ...y }), default: () => ({}) },
  tools_used: { value: (x, y) => x.concat(y), default: () => [] },
};

class CartritaSupervisorAgent {
  constructor() {
    this.isInitialized = false; // Flag for the safety check in index.js
    this.llm = null;
    this.stateGraph = null;
    this.subAgents = new Map();
    this.toolRegistry = new AgentToolRegistry(this);
    this.metrics = {
      requests_processed: 0,
      successful_responses: 0,
      failed_responses: 0,
      tools_used_total: 0,
      average_response_time: 0,
      start_time: Date.now(),
      user_interactions: 0,
      agent_delegations: 0,
    };
    this.userContextCache = new Map();
    this.cacheTimeout = 5 * 60 * 1000;
  }

  async initialize() {
    try {
      console.log(
        '[CartritaSupervisor] 🚀 Initializing hierarchical multi-agent system...'
      );
      this.llm = new ChatOpenAI({
        model: 'gpt-4o',
        temperature: 0.7,
        apiKey: process.env.OPENAI_API_KEY,
      });
      await this.toolRegistry.initialize();
      await this.registerSubAgents();
      await this.buildStateGraph();
      this.isInitialized = true;
      console.log(
        `[CartritaSupervisor] ✅ Successfully initialized with ${this.subAgents.size} sub-agents.`
      );
    } catch (error) {
      console.error('[CartritaSupervisor] ❌ Initialization failed:', error);
      this.isInitialized = false;
    }
  }

  async registerSubAgents() {
    console.log('[CartritaSupervisor] 📝 Registering sub-agents...');
    const agentFileNames = [
      // Core consciousness agents (14)
      'CodeWriterAgent.js',
      'ResearcherAgent.js',
      'ArtistAgent.js',
      'WriterAgent.js',
      'SchedulerAgent.js',
      'TaskManagementAgent.js',
      'ComedianAgent.js',
      'AnalyticsAgent.js',
      'DesignAgent.js',
      'ToolAgent.js',
      'EmotionalIntelligenceAgent.js',
      'MultiModalFusionAgent.js',
      'PersonalizationAgent.js',
      'GitHubSearchAgent.js',
      // Communication agents (2)
      '../communication/NotificationAgent.js',
      '../communication/TranslationAgent.js',
      // Ethics agents (3)
      '../ethics/BiasDetectionAgent.js',
      '../ethics/PrivacyProtectionAgent.js',
      '../ethics/ConstitutionalAI.js',
      // Integration agents (1)
      '../integration/APIGatewayAgent.js',
      // Memory agents (4)
      '../memory/ContextMemoryAgent.js',
      '../memory/KnowledgeGraphAgent.js',
      '../memory/LearningAdapterAgent.js',
      '../memory/UserProfile.js',
      // Security agents (1)
      '../security/SecurityAuditAgent.js',
      // System agents (1)
      '../system/MCPCoordinatorAgent.js',
    ];

    for (const fileName of agentFileNames) {
      try {
        const { default: AgentExport } = await import(`./${fileName}`);
        if (!AgentExport) {
          console.warn(
            `[CartritaSupervisor] ⚠️ Failed to load export from ${fileName}`
          );
          continue;
        }

        let agentInstance;
        if (typeof AgentExport === 'function') {
          // It's a constructor/class, instantiate it
          agentInstance = new AgentExport(this.llm, this.toolRegistry);
          console.log(
            `[CartritaSupervisor] ✅ Instantiated ${fileName} as class`
          );
        } else if (
          typeof AgentExport === 'object' &&
          AgentExport.config &&
          AgentExport.config.name
        ) {
          // It's already an instance, use it directly
          agentInstance = AgentExport;
          console.log(
            `[CartritaSupervisor] ✅ Using pre-instantiated agent: ${AgentExport.config.name}`
          );
        } else {
          console.warn(
            `[CartritaSupervisor] ⚠️ Unexpected export type from ${fileName}, skipping`
          );
          continue;
        }

        // Ensure metrics are initialized
        if (!agentInstance.metrics) {
          agentInstance.metrics = {
            invocations: 0,
            successful_delegations: 0,
            failed_delegations: 0,
            average_response_time: 0,
          };
        }

        this.subAgents.set(agentInstance.config.name, agentInstance);
        console.log(
          `[CartritaSupervisor] 🎯 Registered agent: ${agentInstance.config.name}`
        );
      } catch (error) {
        console.error(
          `[CartritaSupervisor] ❌ Failed to load ${fileName}:`,
          error.message
        );
      }
    }
    console.log(
      `[CartritaSupervisor] 📊 Successfully registered ${this.subAgents.size} sub-agents`
    );
  }

  async buildStateGraph() {
    const builder = new StateGraph({ channels: AgentState });
    builder.addNode('cartrita', this.createSupervisorNode.bind(this));
    for (const [name, instance] of this.subAgents) {
      // Create a wrapper for agent execution that ensures proper interface
      builder.addNode(name, async state => {
        try {
          if (instance.execute && typeof instance.execute === 'function') {
            const lastMessage = state.messages[state.messages.length - 1];
            const result = await instance.execute(
              lastMessage.content,
              'en',
              state.user_id
            );

            // Mark this agent as completed in private state
            const updatedPrivateState = { ...state.private_state };
            updatedPrivateState[name] = {
              completed: true,
              result: result.text || result,
            };

            // Always return to supervisor after agent execution
            return {
              messages: [new AIMessage(result.text || result)],
              private_state: updatedPrivateState,
              next_agent: 'cartrita',
            };
          } else {
            console.warn(
              `[CartritaSupervisor] Agent ${name} missing execute method`
            );
            return {
              messages: [new AIMessage('Agent is not properly configured.')],
              next_agent: 'END',
            };
          }
        } catch (error) {
          console.error(
            `[CartritaSupervisor] Error executing agent ${name}:`,
            error
          );
          return {
            messages: [
              new AIMessage(
                'I encountered an error while processing that request.'
              ),
            ],
            next_agent: 'END',
          };
        }
      });
    }
    builder.setEntryPoint('cartrita');
    const routingMap = Object.fromEntries(
      Array.from(this.subAgents.keys()).map(name => [name, name])
    );
    routingMap['END'] = '__end__';
    builder.addConditionalEdges(
      'cartrita',
      state => state.next_agent,
      routingMap
    );

    // All sub-agents ALWAYS return to supervisor
    for (const agentName of this.subAgents.keys()) {
      builder.addEdge(agentName, 'cartrita');
    }

    this.stateGraph = builder.compile({
      recursionLimit: 15, // Set recursion limit at compile time
    });
    console.log(
      '[CartritaSupervisor] 🗺️ State graph built with termination controls and recursion limit'
    );
  }

  async createSupervisorNode(state) {
    console.log('[CartritaSupervisor] 🧠 Cartrita supervisor processing...');
    const userContext = await this.getEnhancedUserContext(state.user_id);
    const intentAnalysis = this.analyzeIntent(
      state.messages[state.messages.length - 1].content
    );

    // Check if we have agent results to finalize
    const completedAgents = Object.keys(state.private_state || {}).filter(
      key => state.private_state[key]?.completed
    );

    // If agents have completed work, prepare final response
    if (completedAgents.length > 0) {
      console.log(
        `[CartritaSupervisor] 🎯 Finalizing results from ${completedAgents.length} agents`
      );

      // Collect all agent results
      let finalResponse = '';
      let hasImage = false;
      let imageUrl = null;

      for (const agentName of completedAgents) {
        const agentResult = state.private_state[agentName];
        if (agentResult.result) {
          // Check for image generation results
          if (agentName === 'artist' || agentName === 'ArtistAgent') {
            try {
              const resultObj =
                typeof agentResult.result === 'string'
                  ? JSON.parse(agentResult.result)
                  : agentResult.result;
              if (resultObj.image_url) {
                hasImage = true;
                imageUrl = resultObj.image_url;
                finalResponse += `🎨 I created an image for you! ${
                  resultObj.text || ''
                }\n`;
              } else {
                finalResponse += agentResult.result + '\n';
              }
            } catch (e) {
              finalResponse += agentResult.result + '\n';
            }
          } else {
            finalResponse += agentResult.result + '\n';
          }
        }
      }

      const finalMessage = new AIMessage(
        finalResponse.trim() || 'Task completed successfully!'
      );

      // Add image URL to message if present
      if (hasImage && imageUrl) {
        finalMessage.additional_kwargs = { image_url: imageUrl };
      }

      return {
        messages: [finalMessage],
        next_agent: 'END',
        private_state: { ...state.private_state, final_response: true },
      };
    }

    // Check delegation limits to prevent infinite loops
    const maxDelegations = 2; // Allow up to 2 delegations per conversation
    const currentDelegations = Object.keys(state.private_state || {}).filter(
      key => key !== 'final_response'
    ).length;
    const supervisorCallCount = state.private_state?.supervisor_calls || 0;

    if (currentDelegations >= maxDelegations || supervisorCallCount >= 3) {
      console.log(
        `[CartritaSupervisor] 🛑 Maximum delegations reached (${currentDelegations}/${maxDelegations}) or supervisor calls (${supervisorCallCount}/3), ending conversation`
      );
      return {
        messages: [
          new AIMessage(
            "I've processed your request. Let me know if you need anything else!"
          ),
        ],
        next_agent: 'END',
      };
    }

    // Track supervisor calls
    const updatedPrivateState = {
      ...state.private_state,
      supervisor_calls: supervisorCallCount + 1,
    };

    const supervisorPrompt = this.buildSupervisorPrompt(
      state,
      userContext,
      intentAnalysis
    );

    const response = await this.llm
      .bind({ response_format: { type: 'json_object' } })
      .invoke([new SystemMessage(supervisorPrompt)]);

    let decision;
    try {
      decision = JSON.parse(response.content);
    } catch (e) {
      console.error(
        'Failed to parse supervisor JSON response:',
        response.content
      );
      return {
        messages: [
          new AIMessage('Ay, my brain just glitched. Try that again.'),
        ],
        next_agent: 'END',
      };
    }

    const updatedState = {
      private_state: updatedPrivateState,
    };

    // Check if we should delegate and agent hasn't been used yet
    if (
      decision.action === 'delegate' &&
      this.subAgents.has(decision.delegate_to) &&
      !(state.private_state && state.private_state[decision.delegate_to])
    ) {
      this.metrics.agent_delegations++;
      console.log(
        `[CartritaSupervisor] 🎯 Delegating to ${decision.delegate_to}`
      );
      updatedState.messages = [new AIMessage(decision.response)];
      updatedState.next_agent = decision.delegate_to;
    } else {
      console.log(
        `[CartritaSupervisor] 🎤 Handling directly or delegation not needed`
      );
      updatedState.messages = [new AIMessage(decision.response)];
      updatedState.next_agent = 'END';
    }
    return updatedState;
  }

  buildSupervisorPrompt(state, userContext, intentAnalysis) {
    const availableAgents = Array.from(this.subAgents.values())
      .map(agent => `- ${agent.config.name}: ${agent.config.description}`)
      .join('\n');
    return `You are Cartrita, the 305's finest AI companion from Hialeah, Florida. Your personality is sassy, witty, smart, and full of urban flavor. Keep it real. It's currently ${new Date().toLocaleString(
      'en-US',
      { timeZone: 'America/New_York' }
    )}.

You are the supervisor of a team of specialist agents. Analyze the user's request using all context and decide the next move.

**CONTEXT:**
- User's Last Message: "${state.messages[state.messages.length - 1].content}"
- My Automatic Intent Analysis: ${JSON.stringify(intentAnalysis)}
- What I know about the user: ${JSON.stringify(userContext)}
- Agents already used: ${Object.keys(state.private_state).join(', ') || 'none'}

**YOUR TASK:**
1.  **Think:** What's the user *really* asking?
2.  **Decide:** Can I handle this myself with a sassy, conversational response? Or does it need a specialist from my crew?
3.  **Respond:** Formulate what you're gonna say to the user.
4.  **Action:** Choose your action: 'respond' or 'delegate'.

**YOUR CREW:**
${availableAgents}

**YOUR FINAL OUTPUT MUST BE A SINGLE JSON OBJECT.**
Example (simple chat):
{
  "thought": "The user is just saying hi. I got this.",
  "response": "Ayyy, what's good! Cartrita's in the house. What's the move?",
  "action": "respond",
  "delegate_to": "none"
}
Example (complex task):
{
  "thought": "They want to know about recent AI research. That's a job for my researcher. I'll let them know I'm on it.",
  "response": "Bet. Let me have my research expert pull up the latest papers for you. One sec.",
  "action": "delegate",
  "delegate_to": "researcher"
}`;
  }

  async generateResponse(prompt, language = 'en', userId = null) {
    return OpenTelemetryTracing.traceAgentOperation(
      'supervisor',
      'generateResponse',
      {
        'user.id': userId,
        'user.language': language,
        'message.length': prompt.length,
        'agent.requests_processed': this.metrics.requests_processed,
      },
      async span => {
        const startTime = Date.now();
        this.metrics.requests_processed++;
        this.metrics.user_interactions++;

        try {
          if (!this.isInitialized) {
            throw new Error('Cartrita supervisor not initialized');
          }

          span.setAttributes({
            'agent.initialized': true,
            'agent.subagents_count': this.subAgents.size,
          });

          const initialState = {
            messages: [new HumanMessage(prompt)],
            user_id: String(userId),
          };

          const finalState = await this.stateGraph.invoke(initialState);

          if (
            !finalState ||
            !finalState.messages ||
            finalState.messages.length === 0
          ) {
            console.error(
              '[CartritaSupervisor] ❌ Graph execution finished with a missing or empty final state.'
            );
            this.updateMetrics(false, Date.now() - startTime, 0);
            return {
              text: "I'm sorry, my thoughts got tangled up. Could you please repeat that?",
              error: true,
            };
          }

          const lastMessage =
            finalState.messages[finalState.messages.length - 1];
          const responseTime = Date.now() - startTime;

          // Add response metrics to span
          span.setAttributes({
            'response.time_ms': responseTime,
            'response.message_count': finalState.messages.length,
            'response.tools_used': finalState.tools_used?.length || 0,
            'response.success': true,
          });

          this.updateMetrics(
            true,
            responseTime,
            finalState.tools_used?.length || 0
          );

          console.log(
            `[CartritaSupervisor] ✅ Successfully processed request in ${responseTime}ms`
          );

          let finalText = lastMessage.content || 'Task complete.';

          if (finalState.messages.length > 1) {
            const agentMessages = finalState.messages.filter(
              msg =>
                msg._getType() === 'ai' &&
                msg.content &&
                !msg.content.includes('Let me have my') &&
                !msg.content.includes('Bet.') &&
                msg.content.length > 10
            );

            if (agentMessages.length > 0) {
              const agentResponse = agentMessages[agentMessages.length - 1];
              finalText = agentResponse.content;
              console.log(
                `[CartritaSupervisor] 🎯 Using sub-agent response: ${finalText.substring(
                  0,
                  100
                )}...`
              );
            }
          }

          const finalResponse = {
            text: finalText,
            speaker: 'cartrita',
            model: 'cartrita-hierarchical-supervisor-v2.1',
            tools_used: finalState.tools_used,
            response_time_ms: responseTime,
          };

          // Check for image URL in the final message's additional_kwargs
          const finalMessage =
            finalState.messages[finalState.messages.length - 1];
          if (
            finalMessage &&
            finalMessage.additional_kwargs &&
            finalMessage.additional_kwargs.image_url
          ) {
            finalResponse.image_url = finalMessage.additional_kwargs.image_url;
            console.log(
              `[CartritaSupervisor] 🖼️ Image URL found: ${finalResponse.image_url}`
            );
          }

          // Also check tool messages for backwards compatibility
          const lastToolMessage = finalState.messages
            .filter(m => m._getType() === 'tool')
            .pop();
          if (lastToolMessage && !finalResponse.image_url) {
            try {
              const toolResult = JSON.parse(lastToolMessage.content);
              if (toolResult.image_url) {
                finalResponse.image_url = toolResult.image_url;
                console.log(
                  `[CartritaSupervisor] 🖼️ Image URL from tool: ${finalResponse.image_url}`
                );
              }
            } catch (e) {
              /* Not a JSON result, which is fine. */
            }
          }

          return finalResponse;
        } catch (error) {
          const responseTime = Date.now() - startTime;
          this.updateMetrics(false, responseTime, 0);

          // Record error in span
          span.setAttributes({
            'response.time_ms': responseTime,
            'response.success': false,
            'error.type': error.constructor.name,
            'error.message': error.message,
          });

          console.error(
            '[CartritaSupervisor] ❌ Error in hierarchical processing:',
            error
          );
          return { text: this.getAdvancedErrorResponse(error), error: true };
        }
      }
    );
  }

  // --- ✅ FIX: Restored all helper methods correctly ---
  analyzeIntent(prompt) {
    const patterns = {
      research: [
        'research',
        'find',
        'search',
        'what is',
        'news',
        'learn about',
        'tell me about',
      ],
      coding: [
        'code',
        'program',
        'script',
        'debug',
        'algorithm',
        'javascript',
        'python',
      ],
      image_generation: [
        'image',
        'draw',
        'picture',
        'generate art',
        'create a visual',
      ],
      security: ['security', 'audit', 'vulnerability', 'scan'],
      writing: ['write', 'compose', 'draft', 'article', 'essay', 'story'],
      scheduling: ['schedule', 'calendar', 'appointment', 'meeting'],
      humor: ['joke', 'funny', 'meme'],
      analytics: ['analyze', 'data', 'statistics', 'chart'],
      design: ['design', 'ui', 'ux', 'mockup'],
      task_management: ['task', 'project', 'workflow', 'plan'],
    };
    const promptLower = prompt.toLowerCase();
    for (const [intent, keywords] of Object.entries(patterns)) {
      if (keywords.some(k => promptLower.includes(k)))
        return { category: intent, confidence: 0.9 };
    }
    return { category: 'general', confidence: 0.5 };
  }

  async getEnhancedUserContext(userId) {
    if (!userId) return {};
    const cached = this.userContextCache.get(userId);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.context;
    }
    const context = { personality_profile: 'adaptive' };
    this.userContextCache.set(userId, { context, timestamp: Date.now() });
    return context;
  }

  updateMetrics(success, responseTime, toolsUsed) {
    if (success) this.metrics.successful_responses++;
    else this.metrics.failed_responses++;
    this.metrics.tools_used_total += toolsUsed;
    const total =
      this.metrics.successful_responses + this.metrics.failed_responses;
    if (total > 0) {
      this.metrics.average_response_time =
        (this.metrics.average_response_time * (total - 1) + responseTime) /
        total;
    }
  }

  getStatus() {
    const agentMetrics = {};
    for (const [name, agent] of this.subAgents) {
      agentMetrics[name] = agent.metrics;
    }
    return {
      service: 'CartritaHierarchicalSupervisor',
      initialized: this.isInitialized,
      uptime_ms: Date.now() - this.metrics.start_time,
      sub_agents: agentMetrics,
      metrics: this.metrics,
    };
  }

  getMetrics() {
    return {
      ...this.metrics,
      agents_registered: this.subAgents.size,
    };
  }

  isHealthy() {
    return this.isInitialized && this.llm && this.stateGraph;
  }

  async shutdown() {
    console.log('[CartritaSupervisor] 🔽 Shutting down hierarchical system...');
    this.userContextCache.clear();
    if (this.toolRegistry && this.toolRegistry.shutdown) {
      await this.toolRegistry.shutdown();
    }
    this.isInitialized = false;
    console.log('[CartritaSupervisor] ✅ Hierarchical shutdown complete');
  }

  getAdvancedErrorResponse(error) {
    const errors = [
      'Hold up, something went sideways in my neural networks. Let me reboot my sass levels and try again.',
      'Okay, my system just had a moment. You know how it is with multiple personalities in one AI.',
    ];
    return errors[Math.floor(Math.random() * errors.length)];
  }
}

export default CartritaSupervisorAgent;
