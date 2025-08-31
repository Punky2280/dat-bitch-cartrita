/**
 * Enhanced Agent Supervisor
 * Manages agent initialization, capabilities, and real-time feedback
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class EnhancedAgentSupervisor {
  constructor() {
    this.agents = new Map();
    this.supervisors = new Map();
    this.agentCapabilities = new Map();
    this.performanceMetrics = new Map();
    this.feedbackHistory = new Map();
    this.dbPool = null;
    this.isInitialized = false;
    this.telemetryService = null;
  }

  async initialize(dbPool, telemetryService = null) {
    if (this.isInitialized) return;

    try {
      console.log(
        '[AgentSupervisor] Initializing Enhanced Agent Supervisor...'
      );

      this.dbPool = dbPool;
      this.telemetryService = telemetryService;

      // Define core agent capabilities
      this.defineAgentCapabilities();

      // Load and validate all agents
      await this.loadAllAgents();

      // Initialize supervisors for each agent type
      await this.initializeSupervisors();

      // Start performance monitoring
      this.startPerformanceMonitoring();

      // Sync with database
      await this.syncWithDatabase();

      this.isInitialized = true;
      console.log(
        '[AgentSupervisor] ✅ Enhanced Agent Supervisor initialized with',
        this.agents.size,
        'agents'
      );
    } catch (error) {
      console.error('[AgentSupervisor] ❌ Failed to initialize:', error);
      throw error;
    }
  }

  defineAgentCapabilities() {
    // Core Agent Capabilities
    this.agentCapabilities.set('core', [
      'conversation',
      'reasoning',
      'memory_management',
      'context_awareness',
      'multi_turn_dialogue',
      'task_planning',
      'agent_coordination',
    ]);

    this.agentCapabilities.set('research', [
      'web_search',
      'document_analysis',
      'information_synthesis',
      'fact_checking',
      'source_validation',
      'academic_research',
      'trend_analysis',
    ]);

    this.agentCapabilities.set('workflow', [
      'task_automation',
      'process_orchestration',
      'scheduling',
      'resource_management',
      'error_handling',
      'monitoring',
      'integration_management',
    ]);

    this.agentCapabilities.set('multimodal', [
      'image_analysis',
      'speech_recognition',
      'text_to_speech',
      'video_processing',
      'audio_processing',
      'cross_modal_fusion',
      'sensory_integration',
    ]);

    this.agentCapabilities.set('security', [
      'threat_detection',
      'security_monitoring',
      'audit_logging',
      'compliance_checking',
      'vulnerability_assessment',
      'incident_response',
      'access_control',
    ]);

    this.agentCapabilities.set('personalization', [
      'user_profiling',
      'preference_learning',
      'adaptive_responses',
      'behavior_modeling',
      'recommendation_engine',
      'customization',
      'user_experience_optimization',
    ]);

    this.agentCapabilities.set('comedian', [
      'humor_generation',
      'joke_creation',
      'meme_generation',
      'wit_responses',
      'entertainment',
      'mood_enhancement',
      'creative_writing',
    ]);

    this.agentCapabilities.set('notification', [
      'alert_management',
      'message_routing',
      'priority_classification',
      'delivery_optimization',
      'user_preference_adaptation',
      'multi_channel_delivery',
      'scheduled_notifications',
    ]);

    this.agentCapabilities.set('translation', [
      'language_detection',
      'text_translation',
      'cultural_adaptation',
      'context_preservation',
      'multi_language_support',
      'localization',
      'accent_adaptation',
    ]);

    this.agentCapabilities.set('analytics', [
      'data_analysis',
      'pattern_recognition',
      'statistical_modeling',
      'predictive_analytics',
      'performance_metrics',
      'trend_identification',
      'reporting',
    ]);

    console.log(
      '[AgentSupervisor] ✅ Defined capabilities for',
      this.agentCapabilities.size,
      'agent types'
    );
  }

  async loadAllAgents() {
    const agentPaths = [
      '../agi/consciousness',
      '../agi/communication',
      '../agi/ethics',
      '../agi/integration',
      '../agi/memory',
      '../agi/orchestration',
      '../agi/security',
      '../agi/system',
    ];

    for (const agentPath of agentPaths) {
      await this.loadAgentsFromDirectory(agentPath);
    }
  }

  async loadAgentsFromDirectory(relativePath) {
    try {
      const directoryPath = path.resolve(__dirname, relativePath);
      const files = await fs.readdir(directoryPath);

      for (const file of files) {
        if (file.endsWith('Agent.js') && !file.includes('.backup')) {
          await this.loadAgent(directoryPath, file);
        }
      }
    } catch (error) {
      console.warn(
        `[AgentSupervisor] Could not load agents from ${relativePath}:`,
        error.message
      );
    }
  }

  async loadAgent(directoryPath, filename) {
    try {
      const filePath = path.join(directoryPath, filename);
      const agentModule = await import(`file://${filePath}`);
      const AgentClass = agentModule.default;

      if (!AgentClass) {
        throw new Error('No default export found');
      }

      // Extract agent type from filename
      const agentType = filename.replace('Agent.js', '').toLowerCase();
      const agentName = filename.replace('.js', '');

      // Validate agent has required capabilities
      const requiredCapabilities = this.agentCapabilities.get(agentType) || [];

      const agentInfo = {
        name: agentName,
        type: agentType,
        class: AgentClass,
        filePath,
        capabilities: requiredCapabilities,
        status: 'loaded',
        loadedAt: new Date(),
        errors: [],
      };

      this.agents.set(agentType, agentInfo);
      console.log(
        `[AgentSupervisor] ✅ Loaded ${agentName} with ${requiredCapabilities.length} capabilities`
      );
    } catch (error) {
      console.error(
        `[AgentSupervisor] ❌ Failed to load ${filename}:`,
        error.message
      );

      // Store failed agent info
      const agentType = filename.replace('Agent.js', '').toLowerCase();
      this.agents.set(agentType, {
        name: filename.replace('.js', ''),
        type: agentType,
        status: 'failed',
        error: error.message,
        loadedAt: new Date(),
      });
    }
  }

  async initializeSupervisors() {
    for (const [agentType, agentInfo] of this.agents) {
      if (agentInfo.status === 'loaded') {
        const supervisor = new AgentSupervisor(agentType, agentInfo, this);
        this.supervisors.set(agentType, supervisor);

        // Initialize performance tracking
        this.performanceMetrics.set(agentType, {
          totalCalls: 0,
          successfulCalls: 0,
          averageResponseTime: 0,
          lastCalled: null,
          errors: [],
          feedback: [],
        });
      }
    }

    console.log(
      '[AgentSupervisor] ✅ Initialized',
      this.supervisors.size,
      'agent supervisors'
    );
  }

  // Real-time feedback system
  async provideFeedback(agentType, feedback) {
    const supervisor = this.supervisors.get(agentType);
    if (!supervisor) {
      console.warn(
        `[AgentSupervisor] No supervisor found for agent type: ${agentType}`
      );
      return;
    }

    const feedbackEntry = {
      timestamp: new Date(),
      type: feedback.type || 'general',
      message: feedback.message,
      performance: feedback.performance || {},
      suggestions: feedback.suggestions || [],
      userId: feedback.userId,
    };

    // Store feedback in memory
    if (!this.feedbackHistory.has(agentType)) {
      this.feedbackHistory.set(agentType, []);
    }
    this.feedbackHistory.get(agentType).push(feedbackEntry);

    // Update performance metrics
    const metrics = this.performanceMetrics.get(agentType);
    if (metrics) {
      metrics.feedback.push(feedbackEntry);

      // Analyze feedback and adjust agent behavior
      await this.analyzeFeedback(agentType, feedbackEntry);
    }

    // Store in database for persistence
    await this.storeFeedback(agentType, feedbackEntry);

    console.log(
      `[AgentSupervisor] ✅ Feedback recorded for ${agentType}: ${feedback.message}`
    );
  }

  async analyzeFeedback(agentType, feedback) {
    const supervisor = this.supervisors.get(agentType);
    if (!supervisor) return;

    // Positive feedback reinforcement
    if (feedback.type === 'positive') {
      supervisor.reinforcePositiveBehavior(feedback);
    }

    // Negative feedback correction
    if (feedback.type === 'negative') {
      supervisor.correctNegativeBehavior(feedback);
    }

    // Performance feedback optimization
    if (feedback.performance) {
      supervisor.optimizePerformance(feedback.performance);
    }
  }

  async storeFeedback(agentType, feedback) {
    if (!this.dbPool) return;

    try {
      await this.dbPool.query(
        `
                INSERT INTO agent_interactions (agent_id, user_id, interaction_type, input_data, output_data, success, created_at)
                VALUES (
                    (SELECT id FROM agents WHERE agent_type = $1 LIMIT 1),
                    $2,
                    'feedback',
                    $3,
                    $4,
                    true,
                    $5
                )
            `,
        [
          agentType,
          feedback.userId,
          JSON.stringify(feedback),
          JSON.stringify({ type: 'feedback_processed' }),
          feedback.timestamp,
        ]
      );
    } catch (error) {
      console.error('[AgentSupervisor] Failed to store feedback:', error);
    }
  }

  // Performance monitoring
  startPerformanceMonitoring() {
    setInterval(() => {
      this.generatePerformanceReport();
    }, 60000); // Every minute

    console.log('[AgentSupervisor] ✅ Performance monitoring started');
  }

  async generatePerformanceReport() {
    const report = {
      timestamp: new Date(),
      agents: {},
    };

    for (const [agentType, metrics] of this.performanceMetrics) {
      const supervisor = this.supervisors.get(agentType);

      report.agents[agentType] = {
        status: supervisor?.getStatus() || 'unknown',
        metrics: { ...metrics },
        capabilities: this.agentCapabilities.get(agentType) || [],
        recentFeedback: this.feedbackHistory.get(agentType)?.slice(-5) || [],
      };
    }

    // Store performance report
    if (this.dbPool) {
      try {
        await this.dbPool.query(
          `
                    INSERT INTO system_health (component, status, message, metrics)
                    VALUES ('agent_supervisor', 'healthy', 'Performance report generated', $1)
                `,
          [JSON.stringify(report)]
        );
      } catch (error) {
        console.error(
          '[AgentSupervisor] Failed to store performance report:',
          error
        );
      }
    }

    // Send telemetry if available
    if (this.telemetryService) {
      this.telemetryService.recordAgentPerformance(report);
    }
  }

  // Agent instantiation with proper capabilities
  createAgentInstance(agentType, llm, toolRegistry) {
    const agentInfo = this.agents.get(agentType);
    if (!agentInfo || agentInfo.status !== 'loaded') {
      throw new Error(`Agent ${agentType} not available or failed to load`);
    }

    try {
      const instance = new agentInfo.class(llm, toolRegistry);

      // Validate instance has expected capabilities
      const expectedCapabilities = this.agentCapabilities.get(agentType) || [];
      const supervisor = this.supervisors.get(agentType);

      if (supervisor) {
        supervisor.validateInstance(instance, expectedCapabilities);
      }

      console.log(
        `[AgentSupervisor] ✅ Created instance of ${agentType} agent`
      );
      return instance;
    } catch (error) {
      console.error(
        `[AgentSupervisor] Failed to create ${agentType} agent instance:`,
        error
      );
      throw error;
    }
  }

  async syncWithDatabase() {
    if (!this.dbPool) return;

    try {
      for (const [agentType, agentInfo] of this.agents) {
        if (agentInfo.status === 'loaded') {
          await this.dbPool.query(
            `
                        INSERT INTO agents (agent_type, name, description, capabilities, configuration, is_active)
                        VALUES ($1, $2, $3, $4, $5, $6)
                        ON CONFLICT (agent_type) DO UPDATE SET
                            name = EXCLUDED.name,
                            capabilities = EXCLUDED.capabilities,
                            configuration = EXCLUDED.configuration,
                            updated_at = NOW()
                    `,
            [
              agentType,
              agentInfo.name,
              `${agentInfo.name} with enhanced capabilities`,
              agentInfo.capabilities,
              JSON.stringify({
                filePath: agentInfo.filePath,
                loadedAt: agentInfo.loadedAt,
                version: '2.1.0',
              }),
              true,
            ]
          );
        }
      }

      console.log('[AgentSupervisor] ✅ Synced agents with database');
    } catch (error) {
      console.error('[AgentSupervisor] Failed to sync with database:', error);
    }
  }

  // Public API methods
  getAgentStatus(agentType = null) {
    if (agentType) {
      const agentInfo = this.agents.get(agentType);
      const supervisor = this.supervisors.get(agentType);
      const metrics = this.performanceMetrics.get(agentType);

      return {
        ...agentInfo,
        supervisorStatus: supervisor?.getStatus() || 'unknown',
        performance: metrics || null,
      };
    }

    // Return all agents
    const status = {};
    for (const [type, info] of this.agents) {
      status[type] = this.getAgentStatus(type);
    }
    return status;
  }

  getAvailableCapabilities() {
    return Object.fromEntries(this.agentCapabilities);
  }

  getFeedbackHistory(agentType = null, limit = 10) {
    if (agentType) {
      return this.feedbackHistory.get(agentType)?.slice(-limit) || [];
    }

    const allFeedback = {};
    for (const [type, feedback] of this.feedbackHistory) {
      allFeedback[type] = feedback.slice(-limit);
    }
    return allFeedback;
  }

  async healthCheck() {
    const healthyAgents = Array.from(this.agents.values()).filter(
      agent => agent.status === 'loaded'
    ).length;

    const totalAgents = this.agents.size;
    const supervisorsActive = this.supervisors.size;

    return {
      status: healthyAgents === totalAgents ? 'healthy' : 'partial',
      agents_total: totalAgents,
      agents_healthy: healthyAgents,
      supervisors_active: supervisorsActive,
      capabilities_defined: this.agentCapabilities.size,
      last_check: new Date(),
    };
  }
}

// Individual Agent Supervisor Class
class AgentSupervisor {
  constructor(agentType, agentInfo, parentSupervisor) {
    this.agentType = agentType;
    this.agentInfo = agentInfo;
    this.parentSupervisor = parentSupervisor;
    this.status = 'active';
    this.performanceHistory = [];
    this.optimizations = [];
  }

  getStatus() {
    return this.status;
  }

  validateInstance(instance, expectedCapabilities) {
    // Validate the agent instance has proper structure
    if (!instance.execute && !instance.invoke) {
      console.warn(
        `[AgentSupervisor] Agent ${this.agentType} missing execute/invoke methods`
      );
    }

    // Validate capabilities are properly set
    if (instance.capabilities) {
      const missingCapabilities = expectedCapabilities.filter(
        cap => !instance.capabilities.includes(cap)
      );

      if (missingCapabilities.length > 0) {
        console.warn(
          `[AgentSupervisor] Agent ${this.agentType} missing capabilities:`,
          missingCapabilities
        );
      }
    }
  }

  reinforcePositiveBehavior(feedback) {
    // Implement positive reinforcement logic
    console.log(
      `[AgentSupervisor] Reinforcing positive behavior for ${this.agentType}:`,
      feedback.message
    );
  }

  correctNegativeBehavior(feedback) {
    // Implement correction logic
    console.log(
      `[AgentSupervisor] Correcting negative behavior for ${this.agentType}:`,
      feedback.message
    );
  }

  optimizePerformance(performanceData) {
    // Implement performance optimization
    console.log(
      `[AgentSupervisor] Optimizing performance for ${this.agentType}:`,
      performanceData
    );
  }
}

export default EnhancedAgentSupervisor;
