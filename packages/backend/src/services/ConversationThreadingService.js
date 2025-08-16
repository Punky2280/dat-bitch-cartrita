/**
 * Multi-Agent Conversation Threading System
 * 
 * Sophisticated conversation threading system that maintains context across multiple agents,
 * tracks decision chains, and preserves conversation history with proper agent attribution
 * and state management.
 * 
 * @author Robbie Allen - Lead Architect
 * @date January 2025
 */

import { v4 as uuidv4 } from 'uuid';
import { traceOperation } from '../system/OpenTelemetryTracing.js';
import StructuredOutputService from './StructuredOutputService.js';
import db from '../db.js';

export class ConversationThreadingService {
  constructor() {
    this.structuredService = new StructuredOutputService();
    this.activeThreads = new Map();
    this.threadContexts = new Map();
    this.agentDecisionChains = new Map();
  }

  /**
   * Initialize a new conversation thread
   */
  async initializeThread(userId, conversationId, initialContext = {}) {
    return traceOperation('conversation.thread.initialize', async (span) => {
      try {
        const threadId = uuidv4();
        
        const threadData = {
          id: threadId,
          userId,
          conversationId,
          createdAt: new Date().toISOString(),
          lastActivity: new Date().toISOString(),
          participants: new Set(['user']), // Start with just user
          agentHistory: [],
          decisionChain: [],
          contextStack: [initialContext],
          sharedState: {},
          metadata: {
            totalMessages: 0,
            agentSwitches: 0,
            lastActiveAgent: null,
            threadStatus: 'active'
          }
        };

        this.activeThreads.set(threadId, threadData);
        await this.persistThread(threadData);

        span.setAttributes({
          'thread.id': threadId,
          'thread.user_id': userId,
          'thread.conversation_id': conversationId
        });

        return threadId;

      } catch (error) {
        span.recordException(error);
        throw error;
      }
    });
  }

  /**
   * Add a message to the conversation thread
   */
  async addMessage(threadId, message, agentName = null) {
    return traceOperation('conversation.thread.add_message', async (span) => {
      try {
        const thread = this.activeThreads.get(threadId);
        if (!thread) {
          throw new Error(`Thread ${threadId} not found`);
        }

        const messageData = {
          id: uuidv4(),
          timestamp: new Date().toISOString(),
          role: message.role || (agentName ? 'assistant' : 'user'),
          content: message.content,
          agent: agentName,
          metadata: message.metadata || {},
          contextSnapshot: this.captureContextSnapshot(thread),
          structuredOutput: message.structured || null
        };

        // Update thread statistics
        thread.metadata.totalMessages++;
        thread.lastActivity = messageData.timestamp;

        // Track agent participation
        if (agentName) {
          thread.participants.add(agentName);
          
          // Track agent switches
          if (thread.metadata.lastActiveAgent && thread.metadata.lastActiveAgent !== agentName) {
            thread.metadata.agentSwitches++;
            this.recordAgentHandoff(thread, thread.metadata.lastActiveAgent, agentName, messageData);
          }
          
          thread.metadata.lastActiveAgent = agentName;
        }

        // Add to agent history
        thread.agentHistory.push(messageData);

        // Update shared state if message contains state updates
        if (message.stateUpdates) {
          thread.sharedState = { ...thread.sharedState, ...message.stateUpdates };
        }

        // Store in database
        await this.persistMessage(threadId, messageData);

        span.setAttributes({
          'thread.id': threadId,
          'message.id': messageData.id,
          'message.role': messageData.role,
          'message.agent': agentName || 'none',
          'thread.total_messages': thread.metadata.totalMessages
        });

        return messageData;

      } catch (error) {
        span.recordException(error);
        throw error;
      }
    });
  }

  /**
   * Track agent decision in the decision chain
   */
  async trackAgentDecision(threadId, agentName, decision, reasoning, context = {}) {
    return traceOperation('conversation.thread.track_decision', async (span) => {
      try {
        const thread = this.activeThreads.get(threadId);
        if (!thread) {
          throw new Error(`Thread ${threadId} not found`);
        }

        const decisionData = {
          id: uuidv4(),
          timestamp: new Date().toISOString(),
          agent: agentName,
          decision,
          reasoning,
          context,
          confidence: context.confidence || null,
          alternatives: context.alternatives || [],
          impactedAgents: context.impactedAgents || [],
          sequenceNumber: thread.decisionChain.length + 1
        };

        thread.decisionChain.push(decisionData);

        // Store decision chain in database
        await this.persistDecision(threadId, decisionData);

        span.setAttributes({
          'thread.id': threadId,
          'decision.id': decisionData.id,
          'decision.agent': agentName,
          'decision.sequence': decisionData.sequenceNumber
        });

        return decisionData;

      } catch (error) {
        span.recordException(error);
        throw error;
      }
    });
  }

  /**
   * Get conversation context for an agent
   */
  async getAgentContext(threadId, agentName, contextDepth = 10) {
    return traceOperation('conversation.thread.get_agent_context', async (span) => {
      try {
        const thread = this.activeThreads.get(threadId);
        if (!thread) {
          throw new Error(`Thread ${threadId} not found`);
        }

        // Get recent messages
        const recentMessages = thread.agentHistory
          .slice(-contextDepth)
          .map(msg => ({
            role: msg.role,
            content: msg.content,
            agent: msg.agent,
            timestamp: msg.timestamp,
            structured: msg.structuredOutput
          }));

        // Get relevant decisions for this agent
        const relevantDecisions = thread.decisionChain
          .filter(decision => 
            decision.agent === agentName || 
            decision.impactedAgents.includes(agentName)
          )
          .slice(-5); // Last 5 relevant decisions

        // Get shared state
        const sharedState = { ...thread.sharedState };

        // Get agent-specific context
        const agentSpecificContext = this.buildAgentSpecificContext(thread, agentName);

        // Get conversation summary
        const conversationSummary = await this.generateConversationSummary(thread, agentName);

        const context = {
          threadId,
          agent: agentName,
          messages: recentMessages,
          decisions: relevantDecisions,
          sharedState,
          agentContext: agentSpecificContext,
          summary: conversationSummary,
          participants: Array.from(thread.participants),
          metadata: {
            totalMessages: thread.metadata.totalMessages,
            agentSwitches: thread.metadata.agentSwitches,
            lastActivity: thread.lastActivity,
            threadAge: Date.now() - new Date(thread.createdAt).getTime()
          }
        };

        span.setAttributes({
          'thread.id': threadId,
          'context.agent': agentName,
          'context.messages_count': recentMessages.length,
          'context.decisions_count': relevantDecisions.length,
          'context.participants_count': thread.participants.size
        });

        return context;

      } catch (error) {
        span.recordException(error);
        throw error;
      }
    });
  }

  /**
   * Transfer conversation context between agents
   */
  async transferContext(threadId, fromAgent, toAgent, transferData = {}) {
    return traceOperation('conversation.thread.transfer_context', async (span) => {
      try {
        const thread = this.activeThreads.get(threadId);
        if (!thread) {
          throw new Error(`Thread ${threadId} not found`);
        }

        const transferRecord = {
          id: uuidv4(),
          timestamp: new Date().toISOString(),
          fromAgent,
          toAgent,
          transferData,
          contextSnapshot: this.captureContextSnapshot(thread),
          reason: transferData.reason || 'agent_delegation'
        };

        // Add transfer record to thread
        if (!thread.contextTransfers) {
          thread.contextTransfers = [];
        }
        thread.contextTransfers.push(transferRecord);

        // Update shared state with transfer information
        thread.sharedState.lastTransfer = transferRecord;

        // Persist transfer record
        await this.persistContextTransfer(threadId, transferRecord);

        span.setAttributes({
          'thread.id': threadId,
          'transfer.id': transferRecord.id,
          'transfer.from_agent': fromAgent,
          'transfer.to_agent': toAgent
        });

        return transferRecord;

      } catch (error) {
        span.recordException(error);
        throw error;
      }
    });
  }

  /**
   * Get thread analytics and insights
   */
  async getThreadAnalytics(threadId) {
    return traceOperation('conversation.thread.analytics', async (span) => {
      try {
        const thread = this.activeThreads.get(threadId);
        if (!thread) {
          throw new Error(`Thread ${threadId} not found`);
        }

        const analytics = {
          basic: {
            threadId,
            duration: Date.now() - new Date(thread.createdAt).getTime(),
            totalMessages: thread.metadata.totalMessages,
            agentSwitches: thread.metadata.agentSwitches,
            participantCount: thread.participants.size,
            decisionCount: thread.decisionChain.length
          },
          participants: this.analyzeParticipants(thread),
          decisionFlow: this.analyzeDecisionFlow(thread),
          contextEvolution: this.analyzeContextEvolution(thread),
          performance: await this.analyzeThreadPerformance(thread),
          insights: await this.generateThreadInsights(thread)
        };

        span.setAttributes({
          'thread.id': threadId,
          'analytics.duration_ms': analytics.basic.duration,
          'analytics.participants': analytics.basic.participantCount,
          'analytics.decisions': analytics.basic.decisionCount
        });

        return analytics;

      } catch (error) {
        span.recordException(error);
        throw error;
      }
    });
  }

  /**
   * Capture a snapshot of the current thread context
   */
  captureContextSnapshot(thread) {
    return {
      timestamp: new Date().toISOString(),
      messageCount: thread.agentHistory.length,
      participants: Array.from(thread.participants),
      sharedStateKeys: Object.keys(thread.sharedState),
      lastAgent: thread.metadata.lastActiveAgent,
      decisionChainLength: thread.decisionChain.length
    };
  }

  /**
   * Record agent handoff
   */
  recordAgentHandoff(thread, fromAgent, toAgent, message) {
    const handoff = {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      fromAgent,
      toAgent,
      messageId: message.id,
      reason: 'delegation',
      context: this.captureContextSnapshot(thread)
    };

    if (!thread.handoffs) {
      thread.handoffs = [];
    }
    thread.handoffs.push(handoff);

    // Track handoff in decision chain
    this.trackAgentDecision(thread.id, fromAgent, 'handoff', `Delegating to ${toAgent}`, {
      targetAgent: toAgent,
      handoffId: handoff.id
    });

    return handoff;
  }

  /**
   * Build agent-specific context
   */
  buildAgentSpecificContext(thread, agentName) {
    // Get messages from this specific agent
    const agentMessages = thread.agentHistory.filter(msg => msg.agent === agentName);
    
    // Get decisions made by this agent
    const agentDecisions = thread.decisionChain.filter(decision => decision.agent === agentName);
    
    // Calculate agent performance metrics
    const avgResponseTime = this.calculateAgentResponseTime(thread, agentName);
    const successRate = this.calculateAgentSuccessRate(thread, agentName);
    
    return {
      messageCount: agentMessages.length,
      decisionCount: agentDecisions.length,
      firstAppearance: agentMessages.length > 0 ? agentMessages[0].timestamp : null,
      lastAppearance: agentMessages.length > 0 ? agentMessages[agentMessages.length - 1].timestamp : null,
      avgResponseTime,
      successRate,
      specialties: this.inferAgentSpecialties(agentMessages)
    };
  }

  /**
   * Generate conversation summary for agent context
   */
  async generateConversationSummary(thread, forAgent) {
    // Simple extractive summary for now
    // In production, this could use an LLM for better summarization
    
    const recentMessages = thread.agentHistory.slice(-20);
    const topics = this.extractTopics(recentMessages);
    const keyDecisions = thread.decisionChain.slice(-5);
    
    return {
      topics: topics.slice(0, 5), // Top 5 topics
      keyPoints: this.extractKeyPoints(recentMessages),
      recentDecisions: keyDecisions.map(d => ({
        agent: d.agent,
        decision: d.decision,
        timestamp: d.timestamp
      })),
      currentState: this.summarizeCurrentState(thread),
      contextForAgent: this.getAgentContextualSummary(thread, forAgent)
    };
  }

  /**
   * Extract topics from messages
   */
  extractTopics(messages) {
    const words = {};
    
    messages.forEach(msg => {
      if (!msg.content) return;
      
      const tokens = msg.content.toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(word => word.length > 3);
      
      tokens.forEach(word => {
        words[word] = (words[word] || 0) + 1;
      });
    });

    return Object.entries(words)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([word, count]) => ({ topic: word, frequency: count }));
  }

  /**
   * Extract key points from recent messages
   */
  extractKeyPoints(messages) {
    // Simple heuristic-based extraction
    return messages
      .filter(msg => 
        msg.content && (
          msg.content.includes('?') ||
          msg.content.includes('important') ||
          msg.content.includes('need') ||
          msg.content.includes('should') ||
          msg.content.length > 100
        )
      )
      .slice(-3)
      .map(msg => ({
        content: msg.content.slice(0, 200),
        agent: msg.agent,
        timestamp: msg.timestamp
      }));
  }

  /**
   * Summarize current thread state
   */
  summarizeCurrentState(thread) {
    return {
      status: thread.metadata.threadStatus,
      lastActivity: thread.lastActivity,
      activeAgent: thread.metadata.lastActiveAgent,
      participantCount: thread.participants.size,
      pendingActions: this.extractPendingActions(thread),
      sharedVariables: Object.keys(thread.sharedState).length
    };
  }

  /**
   * Get contextual summary specific to an agent
   */
  getAgentContextualSummary(thread, agentName) {
    const agentMessages = thread.agentHistory.filter(msg => msg.agent === agentName);
    const agentDecisions = thread.decisionChain.filter(d => d.agent === agentName);
    
    return {
      hasParticipated: agentMessages.length > 0,
      lastParticipation: agentMessages.length > 0 ? agentMessages[agentMessages.length - 1].timestamp : null,
      decisionsMade: agentDecisions.length,
      expertise: this.inferAgentSpecialties(agentMessages),
      relevanceScore: this.calculateAgentRelevance(thread, agentName)
    };
  }

  /**
   * Analyze thread participants
   */
  analyzeParticipants(thread) {
    const analysis = {};
    
    for (const participant of thread.participants) {
      const messages = thread.agentHistory.filter(msg => 
        msg.agent === participant || (participant === 'user' && !msg.agent)
      );
      
      analysis[participant] = {
        messageCount: messages.length,
        participation: messages.length / thread.agentHistory.length,
        firstMessage: messages.length > 0 ? messages[0].timestamp : null,
        lastMessage: messages.length > 0 ? messages[messages.length - 1].timestamp : null,
        avgMessageLength: messages.reduce((sum, msg) => sum + (msg.content?.length || 0), 0) / Math.max(messages.length, 1)
      };
    }
    
    return analysis;
  }

  /**
   * Analyze decision flow patterns
   */
  analyzeDecisionFlow(thread) {
    const decisions = thread.decisionChain;
    const flow = [];
    
    for (let i = 0; i < decisions.length; i++) {
      const current = decisions[i];
      const next = decisions[i + 1];
      
      flow.push({
        step: i + 1,
        agent: current.agent,
        decision: current.decision,
        confidence: current.confidence,
        nextAgent: next ? next.agent : null,
        timeToNext: next ? new Date(next.timestamp) - new Date(current.timestamp) : null
      });
    }
    
    return {
      totalDecisions: decisions.length,
      uniqueAgents: new Set(decisions.map(d => d.agent)).size,
      avgConfidence: decisions.reduce((sum, d) => sum + (d.confidence || 0.5), 0) / Math.max(decisions.length, 1),
      flow
    };
  }

  /**
   * Analyze how context evolves throughout the conversation
   */
  analyzeContextEvolution(thread) {
    const snapshots = thread.agentHistory.map(msg => msg.contextSnapshot).filter(Boolean);
    
    return {
      contextGrowth: snapshots.map((snapshot, i) => ({
        messageNumber: i + 1,
        participantCount: snapshot.participants.length,
        stateVariables: snapshot.sharedStateKeys.length,
        decisionCount: snapshot.decisionChainLength
      })),
      stateEvolution: this.trackStateVariableEvolution(thread),
      complexityTrend: this.calculateComplexityTrend(snapshots)
    };
  }

  /**
   * Calculate agent response time
   */
  calculateAgentResponseTime(thread, agentName) {
    const agentMessages = thread.agentHistory.filter(msg => msg.agent === agentName);
    if (agentMessages.length < 2) return null;
    
    const times = [];
    for (let i = 1; i < agentMessages.length; i++) {
      const timeDiff = new Date(agentMessages[i].timestamp) - new Date(agentMessages[i-1].timestamp);
      times.push(timeDiff);
    }
    
    return times.reduce((sum, time) => sum + time, 0) / times.length;
  }

  /**
   * Calculate agent success rate based on follow-up interactions
   */
  calculateAgentSuccessRate(thread, agentName) {
    // Simplified heuristic: if another agent doesn't immediately correct or redo the work
    const agentMessages = thread.agentHistory.filter(msg => msg.agent === agentName);
    let successfulInteractions = 0;
    
    agentMessages.forEach((msg, i) => {
      const nextMessages = thread.agentHistory.slice(i + 1, i + 3);
      const hasCorrection = nextMessages.some(next => 
        next.content && (
          next.content.includes('actually') ||
          next.content.includes('correction') ||
          next.content.includes('error')
        )
      );
      
      if (!hasCorrection) successfulInteractions++;
    });
    
    return agentMessages.length > 0 ? successfulInteractions / agentMessages.length : 1;
  }

  /**
   * Infer agent specialties from message content
   */
  inferAgentSpecialties(messages) {
    const specialtyKeywords = {
      'code': ['function', 'class', 'code', 'programming', 'bug', 'debug'],
      'research': ['research', 'study', 'paper', 'analysis', 'data'],
      'creative': ['creative', 'design', 'art', 'write', 'story'],
      'technical': ['technical', 'system', 'architecture', 'implementation'],
      'communication': ['explain', 'clarify', 'discuss', 'communicate']
    };
    
    const scores = {};
    
    messages.forEach(msg => {
      if (!msg.content) return;
      
      const content = msg.content.toLowerCase();
      
      Object.entries(specialtyKeywords).forEach(([specialty, keywords]) => {
        const matches = keywords.filter(keyword => content.includes(keyword)).length;
        scores[specialty] = (scores[specialty] || 0) + matches;
      });
    });
    
    return Object.entries(scores)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([specialty, score]) => ({ specialty, score }));
  }

  /**
   * Calculate agent relevance to current context
   */
  calculateAgentRelevance(thread, agentName) {
    // Simple scoring based on recent activity and decision involvement
    const recentMessages = thread.agentHistory.slice(-10);
    const recentDecisions = thread.decisionChain.slice(-5);
    
    let score = 0;
    
    // Recent message participation
    const recentParticipation = recentMessages.filter(msg => msg.agent === agentName).length;
    score += recentParticipation * 0.3;
    
    // Recent decisions
    const recentDecisionCount = recentDecisions.filter(d => d.agent === agentName || d.impactedAgents.includes(agentName)).length;
    score += recentDecisionCount * 0.4;
    
    // Overall participation ratio
    const totalParticipation = thread.agentHistory.filter(msg => msg.agent === agentName).length;
    score += (totalParticipation / Math.max(thread.agentHistory.length, 1)) * 0.3;
    
    return Math.min(score, 1); // Normalize to 0-1
  }

  /**
   * Extract pending actions from conversation
   */
  extractPendingActions(thread) {
    const recentMessages = thread.agentHistory.slice(-10);
    const pendingActions = [];
    
    recentMessages.forEach(msg => {
      if (msg.content && (
        msg.content.includes('need to') ||
        msg.content.includes('should') ||
        msg.content.includes('will') ||
        msg.content.includes('todo') ||
        msg.content.includes('action')
      )) {
        pendingActions.push({
          messageId: msg.id,
          content: msg.content.slice(0, 100),
          agent: msg.agent,
          timestamp: msg.timestamp
        });
      }
    });
    
    return pendingActions.slice(-5); // Last 5 pending actions
  }

  /**
   * Track how state variables evolve
   */
  trackStateVariableEvolution(thread) {
    // Simple tracking of when new state variables are introduced
    const evolution = {};
    
    thread.agentHistory.forEach((msg, i) => {
      if (msg.contextSnapshot && msg.contextSnapshot.sharedStateKeys) {
        msg.contextSnapshot.sharedStateKeys.forEach(key => {
          if (!evolution[key]) {
            evolution[key] = {
              introducedAt: i + 1,
              introducedBy: msg.agent,
              timestamp: msg.timestamp
            };
          }
        });
      }
    });
    
    return evolution;
  }

  /**
   * Calculate complexity trend over time
   */
  calculateComplexityTrend(snapshots) {
    return snapshots.map((snapshot, i) => ({
      messageNumber: i + 1,
      complexity: (
        snapshot.participants.length +
        snapshot.sharedStateKeys.length +
        snapshot.decisionChainLength
      ) / 3 // Simple complexity metric
    }));
  }

  /**
   * Analyze thread performance metrics
   */
  async analyzeThreadPerformance(thread) {
    const duration = Date.now() - new Date(thread.createdAt).getTime();
    const messagesPerMinute = (thread.metadata.totalMessages / (duration / 60000)) || 0;
    
    return {
      duration,
      messagesPerMinute,
      avgDecisionTime: this.calculateAvgDecisionTime(thread),
      agentEfficiency: this.calculateAgentEfficiency(thread),
      contextRetention: this.calculateContextRetention(thread)
    };
  }

  /**
   * Calculate average time between decisions
   */
  calculateAvgDecisionTime(thread) {
    const decisions = thread.decisionChain;
    if (decisions.length < 2) return null;
    
    const intervals = [];
    for (let i = 1; i < decisions.length; i++) {
      const timeDiff = new Date(decisions[i].timestamp) - new Date(decisions[i-1].timestamp);
      intervals.push(timeDiff);
    }
    
    return intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
  }

  /**
   * Calculate agent efficiency metrics
   */
  calculateAgentEfficiency(thread) {
    const efficiency = {};
    
    for (const participant of thread.participants) {
      if (participant === 'user') continue;
      
      const messages = thread.agentHistory.filter(msg => msg.agent === participant);
      const decisions = thread.decisionChain.filter(d => d.agent === participant);
      
      efficiency[participant] = {
        messagesPerDecision: messages.length / Math.max(decisions.length, 1),
        avgConfidence: decisions.reduce((sum, d) => sum + (d.confidence || 0.5), 0) / Math.max(decisions.length, 1),
        responseTime: this.calculateAgentResponseTime(thread, participant)
      };
    }
    
    return efficiency;
  }

  /**
   * Calculate how well context is retained across agent switches
   */
  calculateContextRetention(thread) {
    if (!thread.handoffs || thread.handoffs.length === 0) return 1;
    
    // Simple metric based on whether context transfers happen smoothly
    const successfulTransfers = thread.handoffs.filter(handoff => {
      // Look for follow-up messages that reference previous context
      const nextMessages = thread.agentHistory
        .filter(msg => new Date(msg.timestamp) > new Date(handoff.timestamp))
        .slice(0, 3);
      
      return nextMessages.some(msg => 
        msg.content && (
          msg.content.includes('following up') ||
          msg.content.includes('continuing') ||
          msg.content.includes('as mentioned')
        )
      );
    }).length;
    
    return successfulTransfers / thread.handoffs.length;
  }

  /**
   * Generate insights about the thread
   */
  async generateThreadInsights(thread) {
    return {
      dominantAgent: this.findDominantAgent(thread),
      conversationPattern: this.identifyConversationPattern(thread),
      collaborationQuality: this.assessCollaborationQuality(thread),
      recommendations: this.generateRecommendations(thread)
    };
  }

  /**
   * Find the most dominant agent in the conversation
   */
  findDominantAgent(thread) {
    const participation = {};
    
    thread.agentHistory.forEach(msg => {
      if (msg.agent) {
        participation[msg.agent] = (participation[msg.agent] || 0) + 1;
      }
    });
    
    const dominant = Object.entries(participation)
      .sort((a, b) => b[1] - a[1])[0];
    
    return dominant ? {
      agent: dominant[0],
      messageCount: dominant[1],
      dominanceRatio: dominant[1] / thread.agentHistory.length
    } : null;
  }

  /**
   * Identify conversation patterns
   */
  identifyConversationPattern(thread) {
    const agentSequence = thread.agentHistory
      .filter(msg => msg.agent)
      .map(msg => msg.agent);
    
    // Detect common patterns
    const patterns = {
      sequential: this.detectSequentialPattern(agentSequence),
      cyclical: this.detectCyclicalPattern(agentSequence),
      hub_spoke: this.detectHubSpokePattern(agentSequence)
    };
    
    return patterns;
  }

  /**
   * Assess collaboration quality between agents
   */
  assessCollaborationQuality(thread) {
    const handoffs = thread.handoffs || [];
    const decisions = thread.decisionChain;
    
    const metrics = {
      handoffSmoothness: this.calculateContextRetention(thread),
      decisionAlignment: this.calculateDecisionAlignment(decisions),
      informationSharing: this.calculateInformationSharing(thread),
      conflictLevel: this.detectConflicts(thread)
    };
    
    const overallScore = (
      metrics.handoffSmoothness * 0.3 +
      metrics.decisionAlignment * 0.3 +
      metrics.informationSharing * 0.2 +
      (1 - metrics.conflictLevel) * 0.2
    );
    
    return { ...metrics, overallScore };
  }

  /**
   * Generate recommendations for improving the conversation
   */
  generateRecommendations(thread) {
    const recommendations = [];
    
    const analytics = this.analyzeParticipants(thread);
    const performance = this.calculateAgentEfficiency(thread);
    
    // Check for low participation
    Object.entries(analytics).forEach(([agent, stats]) => {
      if (stats.participation < 0.1 && agent !== 'user') {
        recommendations.push({
          type: 'low_participation',
          agent,
          suggestion: `Consider engaging ${agent} more actively in the conversation`,
          priority: 'medium'
        });
      }
    });
    
    // Check for long response times
    Object.entries(performance).forEach(([agent, stats]) => {
      if (stats.responseTime > 30000) { // 30 seconds
        recommendations.push({
          type: 'slow_response',
          agent,
          suggestion: `${agent} has slower response times - consider optimization`,
          priority: 'high'
        });
      }
    });
    
    // Check for low confidence decisions
    const lowConfidenceDecisions = thread.decisionChain.filter(d => 
      d.confidence !== null && d.confidence < 0.5
    );
    
    if (lowConfidenceDecisions.length > 0) {
      recommendations.push({
        type: 'low_confidence',
        suggestion: 'Several decisions made with low confidence - consider additional validation',
        priority: 'medium'
      });
    }
    
    return recommendations;
  }

  // Helper methods for pattern detection
  detectSequentialPattern(sequence) {
    // Agents follow a clear sequential order
    const uniqueAgents = [...new Set(sequence)];
    return uniqueAgents.length > 2 && sequence.length > uniqueAgents.length * 2;
  }

  detectCyclicalPattern(sequence) {
    // Agents repeat in cycles
    if (sequence.length < 6) return false;
    
    for (let cycleLength = 2; cycleLength <= sequence.length / 3; cycleLength++) {
      const pattern = sequence.slice(0, cycleLength);
      let matches = 0;
      
      for (let i = cycleLength; i < sequence.length; i += cycleLength) {
        const segment = sequence.slice(i, i + cycleLength);
        if (segment.every((agent, idx) => agent === pattern[idx])) {
          matches++;
        }
      }
      
      if (matches >= 2) return true;
    }
    
    return false;
  }

  detectHubSpokePattern(sequence) {
    // One central agent that others communicate through
    const agentCounts = {};
    sequence.forEach(agent => {
      agentCounts[agent] = (agentCounts[agent] || 0) + 1;
    });
    
    const sortedAgents = Object.entries(agentCounts).sort((a, b) => b[1] - a[1]);
    if (sortedAgents.length < 3) return false;
    
    const dominant = sortedAgents[0];
    const others = sortedAgents.slice(1);
    
    return dominant[1] > others.reduce((sum, [, count]) => sum + count, 0) * 0.8;
  }

  calculateDecisionAlignment(decisions) {
    if (decisions.length < 2) return 1;
    
    let alignedDecisions = 0;
    
    for (let i = 1; i < decisions.length; i++) {
      const current = decisions[i];
      const previous = decisions[i - 1];
      
      // Simple alignment check: decisions don't contradict each other
      if (current.decision !== 'cancel' && 
          current.decision !== 'rollback' &&
          !current.reasoning.includes('error')) {
        alignedDecisions++;
      }
    }
    
    return alignedDecisions / (decisions.length - 1);
  }

  calculateInformationSharing(thread) {
    const stateUpdates = thread.agentHistory.filter(msg => 
      msg.metadata && Object.keys(msg.metadata).length > 0
    ).length;
    
    const structuredOutputs = thread.agentHistory.filter(msg => 
      msg.structuredOutput !== null
    ).length;
    
    return (stateUpdates + structuredOutputs) / Math.max(thread.agentHistory.length, 1);
  }

  detectConflicts(thread) {
    const conflictKeywords = ['error', 'wrong', 'incorrect', 'disagree', 'conflict'];
    
    const conflictMessages = thread.agentHistory.filter(msg => 
      msg.content && conflictKeywords.some(keyword => 
        msg.content.toLowerCase().includes(keyword)
      )
    ).length;
    
    return conflictMessages / Math.max(thread.agentHistory.length, 1);
  }

  // Persistence methods
  async persistThread(threadData) {
    const query = `
      INSERT INTO conversation_threads (
        thread_id, user_id, conversation_id, participants, metadata, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (thread_id) DO UPDATE SET
        participants = EXCLUDED.participants,
        metadata = EXCLUDED.metadata,
        updated_at = NOW()
    `;

    await db.query(query, [
      threadData.id,
      threadData.userId,
      threadData.conversationId,
      JSON.stringify(Array.from(threadData.participants)),
      JSON.stringify(threadData.metadata),
      threadData.createdAt
    ]);
  }

  async persistMessage(threadId, messageData) {
    const query = `
      INSERT INTO conversation_thread_messages (
        message_id, thread_id, role, content, agent, metadata, 
        context_snapshot, structured_output, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `;

    await db.query(query, [
      messageData.id,
      threadId,
      messageData.role,
      messageData.content,
      messageData.agent,
      JSON.stringify(messageData.metadata),
      JSON.stringify(messageData.contextSnapshot),
      messageData.structuredOutput ? JSON.stringify(messageData.structuredOutput) : null,
      messageData.timestamp
    ]);
  }

  async persistDecision(threadId, decisionData) {
    const query = `
      INSERT INTO conversation_thread_decisions (
        decision_id, thread_id, agent, decision, reasoning, 
        confidence, context, sequence_number, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `;

    await db.query(query, [
      decisionData.id,
      threadId,
      decisionData.agent,
      decisionData.decision,
      decisionData.reasoning,
      decisionData.confidence,
      JSON.stringify(decisionData.context),
      decisionData.sequenceNumber,
      decisionData.timestamp
    ]);
  }

  async persistContextTransfer(threadId, transferRecord) {
    const query = `
      INSERT INTO conversation_context_transfers (
        transfer_id, thread_id, from_agent, to_agent, 
        transfer_data, context_snapshot, reason, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `;

    await db.query(query, [
      transferRecord.id,
      threadId,
      transferRecord.fromAgent,
      transferRecord.toAgent,
      JSON.stringify(transferRecord.transferData),
      JSON.stringify(transferRecord.contextSnapshot),
      transferRecord.reason,
      transferRecord.timestamp
    ]);
  }

  /**
   * Clean up inactive threads
   */
  async cleanupInactiveThreads(maxAge = 24 * 60 * 60 * 1000) { // 24 hours
    const cutoffTime = Date.now() - maxAge;
    
    for (const [threadId, thread] of this.activeThreads) {
      const lastActivity = new Date(thread.lastActivity).getTime();
      if (lastActivity < cutoffTime) {
        this.activeThreads.delete(threadId);
        this.threadContexts.delete(threadId);
        this.agentDecisionChains.delete(threadId);
      }
    }
  }

  /**
   * Get service statistics
   */
  getStats() {
    return {
      activeThreads: this.activeThreads.size,
      totalContexts: this.threadContexts.size,
      totalDecisionChains: this.agentDecisionChains.size,
      version: '1.0.0'
    };
  }
}

export default ConversationThreadingService;
