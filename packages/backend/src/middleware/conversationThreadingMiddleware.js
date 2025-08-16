/**
 * Conversation Threading Middleware
 * 
 * Automatically tracks multi-agent conversations, manages context transfers,
 * and maintains decision chains across agent interactions.
 * 
 * @author Robbie Allen - Lead Architect
 * @date January 2025
 */

import ConversationThreadingService from '../services/ConversationThreadingService.js';
import { traceOperation } from '../system/OpenTelemetryTracing.js';

export class ConversationThreadingMiddleware {
  constructor() {
    this.threadingService = new ConversationThreadingService();
    this.activeAgentSessions = new Map(); // Track active agent sessions per user
  }

  /**
   * Initialize conversation thread for a new conversation
   */
  async initializeConversationThread(userId, conversationId, initialContext = {}) {
    return traceOperation('threading.middleware.initialize', async (span) => {
      try {
        const threadId = await this.threadingService.initializeThread(
          userId, 
          conversationId, 
          initialContext
        );

        span.setAttributes({
          'thread.id': threadId,
          'user.id': userId,
          'conversation.id': conversationId
        });

        return threadId;

      } catch (error) {
        span.recordException(error);
        throw error;
      }
    });
  }

  /**
   * Process agent interaction and update thread
   */
  async processAgentInteraction(threadId, agentName, interaction, context = {}) {
    return traceOperation('threading.middleware.process_interaction', async (span) => {
      try {
        // Track the agent decision if this is a decision-making interaction
        if (interaction.decision) {
          await this.threadingService.trackAgentDecision(
            threadId,
            agentName,
            interaction.decision,
            interaction.reasoning || 'Agent decision',
            {
              confidence: interaction.confidence,
              alternatives: interaction.alternatives || [],
              impactedAgents: interaction.impactedAgents || [],
              ...context
            }
          );
        }

        // Add the message to the thread
        const messageData = await this.threadingService.addMessage(threadId, {
          role: 'assistant',
          content: interaction.response || interaction.message || '',
          metadata: {
            model: interaction.model,
            processingTime: interaction.processingTime,
            cost: interaction.cost,
            tokens: interaction.tokens,
            ...interaction.metadata
          },
          structured: interaction.structured,
          stateUpdates: interaction.stateUpdates
        }, agentName);

        // Handle agent handoff if specified
        if (interaction.nextAgent && interaction.nextAgent !== agentName) {
          await this.handleAgentHandoff(
            threadId, 
            agentName, 
            interaction.nextAgent, 
            interaction.handoffReason || 'delegation'
          );
        }

        span.setAttributes({
          'thread.id': threadId,
          'agent.name': agentName,
          'message.id': messageData.id,
          'has.decision': !!interaction.decision,
          'has.handoff': !!interaction.nextAgent
        });

        return messageData;

      } catch (error) {
        span.recordException(error);
        throw error;
      }
    });
  }

  /**
   * Handle agent handoff with context transfer
   */
  async handleAgentHandoff(threadId, fromAgent, toAgent, reason = 'delegation') {
    return traceOperation('threading.middleware.handoff', async (span) => {
      try {
        const startTime = Date.now();

        // Get current context for the from agent
        const fromAgentContext = await this.threadingService.getAgentContext(threadId, fromAgent);

        // Transfer context to the new agent
        const transferData = {
          reason,
          contextSummary: fromAgentContext.summary,
          relevantDecisions: fromAgentContext.decisions.slice(-3),
          sharedState: fromAgentContext.sharedState,
          handoffTime: new Date().toISOString()
        };

        const transfer = await this.threadingService.transferContext(
          threadId,
          fromAgent,
          toAgent,
          transferData
        );

        // Record the handoff
        await this.recordAgentHandoff(threadId, fromAgent, toAgent, reason, transfer.id);

        const processingTime = Date.now() - startTime;

        span.setAttributes({
          'thread.id': threadId,
          'handoff.from_agent': fromAgent,
          'handoff.to_agent': toAgent,
          'handoff.reason': reason,
          'handoff.processing_time': processingTime,
          'transfer.id': transfer.id
        });

        return {
          transferId: transfer.id,
          processingTime,
          contextTransferred: true,
          toAgentContext: await this.threadingService.getAgentContext(threadId, toAgent)
        };

      } catch (error) {
        span.recordException(error);
        throw error;
      }
    });
  }

  /**
   * Record agent handoff in the database
   */
  async recordAgentHandoff(threadId, fromAgent, toAgent, reason, transferId) {
    const query = `
      INSERT INTO conversation_agent_handoffs (
        handoff_id, thread_id, from_agent, to_agent, handoff_reason, 
        context_preserved, handoff_success, processing_time_ms
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `;

    const handoffId = require('uuid').v4();
    await require('../db.js').query(query, [
      handoffId,
      threadId,
      fromAgent,
      toAgent,
      reason,
      true, // context_preserved - assuming success for now
      true, // handoff_success - assuming success for now
      null  // processing_time_ms - will be updated later
    ]);

    return handoffId;
  }

  /**
   * Get enhanced context for an agent including threading information
   */
  async getEnhancedAgentContext(threadId, agentName, options = {}) {
    return traceOperation('threading.middleware.get_enhanced_context', async (span) => {
      try {
        const context = await this.threadingService.getAgentContext(
          threadId, 
          agentName, 
          options.contextDepth || 10
        );

        // Add threading-specific enhancements
        const enhanced = {
          ...context,
          threading: {
            threadId,
            isActiveThread: true,
            agentRole: this.inferAgentRole(context, agentName),
            collaborationHistory: this.getCollaborationHistory(context, agentName),
            recommendedActions: this.generateActionRecommendations(context, agentName)
          }
        };

        span.setAttributes({
          'thread.id': threadId,
          'agent.name': agentName,
          'context.message_count': context.messages.length,
          'context.decision_count': context.decisions.length,
          'context.participants': context.participants.length
        });

        return enhanced;

      } catch (error) {
        span.recordException(error);
        throw error;
      }
    });
  }

  /**
   * Infer the role of an agent in the conversation
   */
  inferAgentRole(context, agentName) {
    const agentMessages = context.messages.filter(msg => msg.agent === agentName);
    const agentDecisions = context.decisions.filter(d => d.agent === agentName);
    
    if (agentDecisions.length > context.decisions.length * 0.5) {
      return 'decision_maker';
    } else if (agentMessages.length > context.messages.length * 0.4) {
      return 'primary_contributor';
    } else if (agentDecisions.some(d => d.impactedAgents.length > 1)) {
      return 'coordinator';
    } else if (agentMessages.length === 0) {
      return 'observer';
    } else {
      return 'contributor';
    }
  }

  /**
   * Get collaboration history for an agent
   */
  getCollaborationHistory(context, agentName) {
    const collaborations = {};
    
    // Track which agents this agent has worked with
    context.messages.forEach(msg => {
      if (msg.agent && msg.agent !== agentName) {
        if (!collaborations[msg.agent]) {
          collaborations[msg.agent] = {
            messageExchanges: 0,
            lastInteraction: null,
            collaborationType: 'sequential'
          };
        }
        collaborations[msg.agent].messageExchanges++;
        collaborations[msg.agent].lastInteraction = msg.timestamp;
      }
    });

    // Analyze decision interactions
    context.decisions.forEach(decision => {
      if (decision.agent === agentName && decision.impactedAgents) {
        decision.impactedAgents.forEach(impactedAgent => {
          if (collaborations[impactedAgent]) {
            collaborations[impactedAgent].collaborationType = 'decision_based';
          }
        });
      }
    });

    return collaborations;
  }

  /**
   * Generate action recommendations for an agent
   */
  generateActionRecommendations(context, agentName) {
    const recommendations = [];
    
    // Check if agent should be more active
    const agentMessages = context.messages.filter(msg => msg.agent === agentName);
    const participation = agentMessages.length / Math.max(context.messages.length, 1);
    
    if (participation < 0.1 && context.participants.includes(agentName)) {
      recommendations.push({
        type: 'increase_participation',
        priority: 'medium',
        suggestion: 'Consider contributing more actively to the conversation'
      });
    }

    // Check for pending decisions that affect this agent
    const relevantDecisions = context.decisions.filter(d => 
      d.impactedAgents.includes(agentName) && 
      Date.now() - new Date(d.timestamp).getTime() < 300000 // 5 minutes
    );
    
    if (relevantDecisions.length > 0) {
      recommendations.push({
        type: 'respond_to_decisions',
        priority: 'high',
        suggestion: `Respond to ${relevantDecisions.length} recent decision(s) that affect you`,
        decisions: relevantDecisions.map(d => d.id)
      });
    }

    // Check conversation flow
    const recentMessages = context.messages.slice(-5);
    const hasUserQuestion = recentMessages.some(msg => 
      msg.role === 'user' && msg.content && msg.content.includes('?')
    );
    
    if (hasUserQuestion && agentMessages.length === 0) {
      recommendations.push({
        type: 'answer_question',
        priority: 'high',
        suggestion: 'User has asked a question that might be within your expertise'
      });
    }

    return recommendations;
  }

  /**
   * Express middleware factory for automatic conversation threading
   */
  createExpressMiddleware(options = {}) {
    return async (req, res, next) => {
      // Attach threading service to request
      req.conversationThreading = this.threadingService;

      // Override res.json to intercept agent responses
      const originalJson = res.json;
      res.json = async function(data) {
        try {
          // Check if this looks like an agent response with threading information
          if (data && data.threadId && data.agentName && req.user?.id) {
            // Process the agent interaction
            setImmediate(async () => {
              try {
                await req.conversationThreading.processAgentInteraction(
                  data.threadId,
                  data.agentName,
                  {
                    response: data.message || data.response,
                    decision: data.decision,
                    reasoning: data.reasoning,
                    confidence: data.confidence,
                    nextAgent: data.next_agent || data.nextAgent,
                    structured: data.structured,
                    metadata: data.metadata || {},
                    processingTime: data.processing_time,
                    model: data.model,
                    cost: data.cost,
                    tokens: data.tokens
                  }
                );
              } catch (error) {
                console.error('[ConversationThreading] Error processing agent interaction:', error);
              }
            });
          }
        } catch (error) {
          console.error('[ConversationThreading] Middleware error:', error);
        }

        return originalJson.call(this, data);
      };

      next();
    };
  }

  /**
   * Socket.IO middleware for real-time conversation threading
   */
  createSocketMiddleware() {
    return (socket, next) => {
      socket.conversationThreading = this.threadingService;

      // Override socket emit to track conversation threading
      const originalEmit = socket.emit;
      socket.emit = function(event, data, ...args) {
        // Track agent messages in real-time conversations
        if (event === 'agent_response' && data && data.threadId) {
          setImmediate(async () => {
            try {
              await socket.conversationThreading.processAgentInteraction(
                data.threadId,
                data.agent,
                {
                  response: data.message,
                  decision: data.decision,
                  reasoning: data.reasoning,
                  structured: data.structured,
                  metadata: data.metadata || {}
                }
              );
            } catch (error) {
              console.error('[ConversationThreading] Socket middleware error:', error);
            }
          });
        }

        return originalEmit.call(this, event, data, ...args);
      };

      next();
    };
  }

  /**
   * Get middleware statistics
   */
  getStats() {
    return {
      activeAgentSessions: this.activeAgentSessions.size,
      threadingService: this.threadingService.getStats(),
      version: '1.0.0'
    };
  }

  /**
   * Cleanup inactive sessions
   */
  async cleanup() {
    await this.threadingService.cleanupInactiveThreads();
    
    // Clean up active agent sessions older than 1 hour
    const cutoffTime = Date.now() - (60 * 60 * 1000);
    for (const [sessionId, sessionData] of this.activeAgentSessions) {
      if (sessionData.lastActivity < cutoffTime) {
        this.activeAgentSessions.delete(sessionId);
      }
    }
  }
}

/**
 * Singleton instance for global use
 */
export const conversationThreadingMiddleware = new ConversationThreadingMiddleware();

export default ConversationThreadingMiddleware;
