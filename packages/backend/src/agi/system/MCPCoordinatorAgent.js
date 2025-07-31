// packages/backend/src/agi/system/MCPCoordinatorAgent.js

const BaseAgent = require('../../system/BaseAgent');
const MessageBus = require('../../system/EnhancedMessageBus');
const MCPMessage = require('../../system/protocols/MCPMessage');

class MCPCoordinatorAgent extends BaseAgent {
  constructor() {
    super('MCPCoordinatorAgent', 'main', [
      'agent_orchestration',
      'message_routing',
      'load_balancing',
      'agent_health_monitoring',
      'system_coordination',
      'workflow_management'
    ]);

    this.setupMessageHandlers();
    this.initializeCoordinatorEngine();
    this.status = 'ready';
    console.log('[MCPCoordinatorAgent.main] Agent initialized and ready');
  }

  setupMessageHandlers() {
    MessageBus.on('mcp.coordinate', this.coordinateAgents.bind(this));
    // MessageBus.on('mcp.balance', this.balanceLoad.bind(this));
    // MessageBus.on('mcp.monitor', this.monitorAgentHealth.bind(this));
    MessageBus.on('workflow.orchestrate', this.orchestrateWorkflow.bind(this));
    // MessageBus.on('system.optimize', this.optimizeSystem.bind(this));
    MessageBus.on(`${this.agentId}.health`, this.healthCheck.bind(this));
  }

  initializeCoordinatorEngine() {
    // Agent registry with capabilities and status
    this.agentRegistry = new Map();
    
    // Load balancing and routing
    this.loadBalancer = {
      strategies: new Map([
        ['round_robin', this.roundRobinStrategy.bind(this)],
        ['least_connections', this.leastConnectionsStrategy.bind(this)],
        ['weighted', this.weightedStrategy.bind(this)],
        ['capability_based', this.capabilityBasedStrategy.bind(this)],
        ['response_time', this.responseTimeStrategy.bind(this)]
      ]),
      currentStrategy: 'capability_based',
      routingTable: new Map()
    };

    // Health monitoring
    this.healthMonitor = {
      checkInterval: 30000, // 30 seconds
      unhealthyThreshold: 3,
      healthChecks: new Map(),
      lastHealthCheck: new Map(),
      healthHistory: new Map()
    };

    // Workflow orchestration
    this.workflowEngine = {
      activeWorkflows: new Map(),
      workflowTemplates: new Map(),
      executionHistory: [],
      dependencies: new Map()
    };

    // System optimization
    this.systemOptimizer = {
      performanceMetrics: new Map(),
      bottlenecks: new Map(),
      optimizationRules: new Map(),
      autoOptimize: true
    };

    // Coordination metrics
    this.coordinationMetrics = {
      messages_routed: 0,
      agents_coordinated: 0,
      workflows_orchestrated: 0,
      load_balancing_decisions: 0,
      health_checks_performed: 0,
      system_optimizations: 0,
      average_coordination_time: 0
    };

    // Initialize system components
    this.initializeWorkflowTemplates();
    this.initializeOptimizationRules();
    this.startHealthMonitoring();
    this.startSystemOptimization();
    
    // Listen for agent registrations/unregistrations
    this.setupAgentRegistryListeners();
  }

  setupAgentRegistryListeners() {
    MessageBus.on('mcp:broadcast', (message) => {
      if (message.type === 'AGENT_REGISTER') {
        this.handleAgentRegistration(message.payload.agent);
      } else if (message.type === 'AGENT_UNREGISTER') {
        this.handleAgentUnregistration(message.payload.agentId);
      }
    });
  }

  handleAgentRegistration(agent) {
    console.log(`[MCPCoordinatorAgent] Registering agent: ${agent.id}`);
    
    this.agentRegistry.set(agent.id, {
      ...agent,
      status: 'active',
      registered_at: new Date().toISOString(),
      last_seen: new Date().toISOString(),
      performance_metrics: {
        response_time: 0,
        success_rate: 100,
        load: 0,
        queue_size: 0
      },
      health_score: 100
    });

    // Update load balancer routing table
    this.updateRoutingTable();
    
    this.coordinationMetrics.agents_coordinated = this.agentRegistry.size;
  }

  handleAgentUnregistration(agentId) {
    console.log(`[MCPCoordinatorAgent] Unregistering agent: ${agentId}`);
    
    this.agentRegistry.delete(agentId);
    this.healthMonitor.healthChecks.delete(agentId);
    this.healthMonitor.lastHealthCheck.delete(agentId);
    this.healthMonitor.healthHistory.delete(agentId);
    
    // Update load balancer routing table
    this.updateRoutingTable();
    
    this.coordinationMetrics.agents_coordinated = this.agentRegistry.size;
  }

  async coordinateAgents(message) {
    try {
      const {
        task_type,
        coordination_strategy = 'auto',
        agents_required = null,
        priority = 'normal',
        options = {}
      } = message.payload;

      const startTime = Date.now();
      
      const coordination = await this.performAgentCoordination(
        task_type,
        coordination_strategy,
        agents_required,
        priority,
        options
      );

      const coordinationTime = Date.now() - startTime;
      this.updateCoordinationMetrics(coordinationTime);

      MessageBus.publish(`mcp.coordination.result.${message.id}`, {
        status: 'completed',
        coordination,
        coordination_time: coordinationTime,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('[MCPCoordinatorAgent] Error coordinating agents:', error);
      MessageBus.publish(`mcp.coordination.error.${message.id}`, {
        status: 'error',
        error: error.message
      });
    }
  }

  async performAgentCoordination(taskType, strategy, agentsRequired, priority, options) {
    // Find suitable agents
    const suitableAgents = this.findSuitableAgents(taskType, agentsRequired);
    
    if (suitableAgents.length === 0) {
      throw new Error(`No suitable agents found for task type: ${taskType}`);
    }

    // Select optimal agents based on strategy
    const selectedAgents = await this.selectOptimalAgents(
      suitableAgents,
      strategy,
      priority,
      options
    );

    // Create coordination plan
    const coordinationPlan = this.createCoordinationPlan(
      taskType,
      selectedAgents,
      priority,
      options
    );

    // Execute coordination
    const executionResult = await this.executeCoordination(coordinationPlan);

    return {
      task_type: taskType,
      strategy: strategy,
      selected_agents: selectedAgents.map(agent => agent.id),
      coordination_plan: coordinationPlan,
      execution_result: executionResult,
      performance_metrics: this.calculateCoordinationMetrics(executionResult)
    };
  }

  findSuitableAgents(taskType, agentsRequired = null) {
    let suitableAgents = [];

    if (agentsRequired) {
      // Use specific agents if requested
      suitableAgents = agentsRequired
        .map(agentId => this.agentRegistry.get(agentId))
        .filter(agent => agent && agent.status === 'active');
    } else {
      // Find agents by capability
      suitableAgents = Array.from(this.agentRegistry.values())
        .filter(agent => 
          agent.status === 'active' && 
          this.agentHasCapability(agent, taskType)
        );
    }

    // Sort by health score and performance
    return suitableAgents.sort((a, b) => {
      const scoreA = a.health_score * (1 - a.performance_metrics.load / 100);
      const scoreB = b.health_score * (1 - b.performance_metrics.load / 100);
      return scoreB - scoreA;
    });
  }

  agentHasCapability(agent, taskType) {
    if (!agent.capabilities) return false;
    
    // Direct capability match
    if (agent.capabilities.includes(taskType)) return true;
    
    // Capability mapping for common task types
    const capabilityMap = {
      'translation': ['language_translation', 'multilingual_support'],
      'security': ['threat_assessment', 'vulnerability_scanning', 'security_monitoring'],
      'analytics': ['data_analysis', 'metrics_generation', 'trend_identification'],
      'design': ['ui_design', 'ux_optimization', 'visual_hierarchy'],
      'notification': ['notification_management', 'multi_channel_delivery'],
      'api': ['api_integration', 'request_routing', 'authentication_management']
    };

    const requiredCapabilities = capabilityMap[taskType] || [];
    return requiredCapabilities.some(cap => agent.capabilities.includes(cap));
  }

  async selectOptimalAgents(suitableAgents, strategy, priority, options) {
    const strategyFunction = this.loadBalancer.strategies.get(strategy) || 
                           this.loadBalancer.strategies.get('capability_based');
    
    const selectedAgents = await strategyFunction(suitableAgents, priority, options);
    
    this.coordinationMetrics.load_balancing_decisions++;
    
    return selectedAgents;
  }

  roundRobinStrategy(agents, priority, options) {
    const maxAgents = options.max_agents || Math.min(3, agents.length);
    return agents.slice(0, maxAgents);
  }

  leastConnectionsStrategy(agents, priority, options) {
    const sortedByLoad = agents.sort((a, b) => 
      a.performance_metrics.load - b.performance_metrics.load
    );
    const maxAgents = options.max_agents || Math.min(2, sortedByLoad.length);
    return sortedByLoad.slice(0, maxAgents);
  }

  weightedStrategy(agents, priority, options) {
    const weights = options.agent_weights || {};
    const weightedAgents = agents.map(agent => ({
      ...agent,
      weight: weights[agent.id] || 1
    })).sort((a, b) => b.weight - a.weight);
    
    const maxAgents = options.max_agents || Math.min(3, weightedAgents.length);
    return weightedAgents.slice(0, maxAgents);
  }

  capabilityBasedStrategy(agents, priority, options) {
    // Group agents by capability strength
    const grouped = agents.reduce((groups, agent) => {
      const capabilityCount = agent.capabilities.length;
      const group = capabilityCount >= 5 ? 'specialist' : 'generalist';
      
      if (!groups[group]) groups[group] = [];
      groups[group].push(agent);
      return groups;
    }, {});

    // Prefer specialists for complex tasks, generalists for simple tasks
    const preferSpecialists = priority === 'high' || options.complex_task;
    const primaryGroup = preferSpecialists ? 'specialist' : 'generalist';
    const secondaryGroup = preferSpecialists ? 'generalist' : 'specialist';

    const selected = [];
    const maxAgents = options.max_agents || 2;

    // Select from primary group first
    if (grouped[primaryGroup]) {
      selected.push(...grouped[primaryGroup].slice(0, Math.ceil(maxAgents / 2)));
    }

    // Fill remaining slots from secondary group
    if (selected.length < maxAgents && grouped[secondaryGroup]) {
      const remaining = maxAgents - selected.length;
      selected.push(...grouped[secondaryGroup].slice(0, remaining));
    }

    return selected;
  }

  responseTimeStrategy(agents, priority, options) {
    const sortedByResponseTime = agents.sort((a, b) => 
      a.performance_metrics.response_time - b.performance_metrics.response_time
    );
    const maxAgents = options.max_agents || Math.min(2, sortedByResponseTime.length);
    return sortedByResponseTime.slice(0, maxAgents);
  }

  createCoordinationPlan(taskType, selectedAgents, priority, options) {
    return {
      id: this.generateCoordinationId(),
      task_type: taskType,
      agents: selectedAgents.map(agent => ({
        id: agent.id,
        role: this.determineAgentRole(agent, taskType),
        priority: priority,
        expected_response_time: agent.performance_metrics.response_time || 5000
      })),
      coordination_type: options.coordination_type || 'parallel',
      timeout: options.timeout || 30000,
      retry_policy: options.retry_policy || { max_retries: 2, backoff: 'exponential' },
      success_criteria: options.success_criteria || { min_successful_agents: 1 },
      created_at: new Date().toISOString()
    };
  }

  determineAgentRole(agent, taskType) {
    // Determine agent role based on capabilities and task type
    if (agent.capabilities.includes('orchestration')) return 'coordinator';
    if (agent.capabilities.includes(taskType)) return 'primary';
    return 'support';
  }

  async executeCoordination(coordinationPlan) {
    const executionResults = new Map();
    const startTime = Date.now();

    try {
      if (coordinationPlan.coordination_type === 'sequential') {
        // Execute agents sequentially
        for (const agentPlan of coordinationPlan.agents) {
          const result = await this.executeAgentTask(agentPlan, coordinationPlan);
          executionResults.set(agentPlan.id, result);
          
          // Check if we can stop early
          if (this.shouldStopEarly(executionResults, coordinationPlan.success_criteria)) {
            break;
          }
        }
      } else {
        // Execute agents in parallel
        const promises = coordinationPlan.agents.map(agentPlan => 
          this.executeAgentTask(agentPlan, coordinationPlan)
        );
        
        const results = await Promise.allSettled(promises);
        
        coordinationPlan.agents.forEach((agentPlan, index) => {
          const result = results[index];
          executionResults.set(agentPlan.id, {
            status: result.status,
            result: result.status === 'fulfilled' ? result.value : null,
            error: result.status === 'rejected' ? result.reason : null
          });
        });
      }

      const executionTime = Date.now() - startTime;
      
      return {
        coordination_id: coordinationPlan.id,
        execution_time: executionTime,
        results: Object.fromEntries(executionResults),
        success: this.evaluateCoordinationSuccess(executionResults, coordinationPlan.success_criteria),
        completed_at: new Date().toISOString()
      };

    } catch (error) {
      return {
        coordination_id: coordinationPlan.id,
        execution_time: Date.now() - startTime,
        results: Object.fromEntries(executionResults),
        success: false,
        error: error.message,
        completed_at: new Date().toISOString()
      };
    }
  }

  async executeAgentTask(agentPlan, coordinationPlan) {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Agent ${agentPlan.id} timed out`));
      }, coordinationPlan.timeout);

      // Send task to agent
      const taskMessage = new MCPMessage({
        type: 'COORDINATION_TASK',
        sender: this.agentId,
        recipient: agentPlan.id,
        payload: {
          task_type: coordinationPlan.task_type,
          role: agentPlan.role,
          priority: agentPlan.priority,
          coordination_id: coordinationPlan.id
        },
        priority: agentPlan.priority
      });

      // Listen for response
      const responseHandler = (message) => {
        if (message.metadata?.response_to === taskMessage.id) {
          clearTimeout(timeoutId);
          MessageBus.removeListener('mcp:message', responseHandler);
          resolve(message.payload);
        }
      };

      MessageBus.on('mcp:message', responseHandler);
      MessageBus.sendMessage(taskMessage);
    });
  }

  shouldStopEarly(results, successCriteria) {
    const successfulResults = Array.from(results.values())
      .filter(result => result.status === 'fulfilled' || result.success);
    
    return successfulResults.length >= successCriteria.min_successful_agents;
  }

  evaluateCoordinationSuccess(results, successCriteria) {
    const successfulResults = Array.from(results.values())
      .filter(result => result.status === 'fulfilled' || result.success);
    
    return successfulResults.length >= successCriteria.min_successful_agents;
  }

  async orchestrateWorkflow(message) {
    try {
      const { workflow_name, workflow_data, options = {} } = message.payload;
      
      const orchestration = await this.performWorkflowOrchestration(
        workflow_name,
        workflow_data,
        options
      );

      this.coordinationMetrics.workflows_orchestrated++;

      MessageBus.publish(`workflow.orchestrated.${message.id}`, {
        status: 'completed',
        orchestration,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('[MCPCoordinatorAgent] Error orchestrating workflow:', error);
      MessageBus.publish(`workflow.orchestration.error.${message.id}`, {
        status: 'error',
        error: error.message
      });
    }
  }

  async performWorkflowOrchestration(workflowName, workflowData, options) {
    const template = this.workflowEngine.workflowTemplates.get(workflowName);
    if (!template) {
      throw new Error(`Workflow template not found: ${workflowName}`);
    }

    const workflowId = this.generateWorkflowId();
    const workflow = {
      id: workflowId,
      name: workflowName,
      template,
      data: workflowData,
      options,
      status: 'running',
      steps: [],
      started_at: new Date().toISOString()
    };

    this.workflowEngine.activeWorkflows.set(workflowId, workflow);

    try {
      // Execute workflow steps
      for (const step of template.steps) {
        const stepResult = await this.executeWorkflowStep(workflow, step);
        workflow.steps.push(stepResult);
        
        if (!stepResult.success && step.required) {
          throw new Error(`Required step failed: ${step.name}`);
        }
      }

      workflow.status = 'completed';
      workflow.completed_at = new Date().toISOString();

    } catch (error) {
      workflow.status = 'failed';
      workflow.error = error.message;
      workflow.failed_at = new Date().toISOString();
    }

    this.workflowEngine.activeWorkflows.delete(workflowId);
    this.workflowEngine.executionHistory.push(workflow);

    return workflow;
  }

  async executeWorkflowStep(workflow, step) {
    const stepStart = Date.now();
    
    try {
      let result;
      
      switch (step.type) {
        case 'agent_coordination':
          result = await this.performAgentCoordination(
            step.task_type,
            step.strategy || 'auto',
            step.agents,
            step.priority || 'normal',
            step.options || {}
          );
          break;
        case 'message_broadcast':
          result = await this.broadcastMessage(step.message, step.recipients);
          break;
        case 'condition_check':
          result = await this.evaluateCondition(step.condition, workflow.data);
          break;
        default:
          throw new Error(`Unknown step type: ${step.type}`);
      }

      return {
        name: step.name,
        type: step.type,
        success: true,
        result,
        execution_time: Date.now() - stepStart,
        completed_at: new Date().toISOString()
      };

    } catch (error) {
      return {
        name: step.name,
        type: step.type,
        success: false,
        error: error.message,
        execution_time: Date.now() - stepStart,
        failed_at: new Date().toISOString()
      };
    }
  }

  initializeWorkflowTemplates() {
    // Security incident response workflow
    this.workflowEngine.workflowTemplates.set('security_incident_response', {
      name: 'Security Incident Response',
      description: 'Automated response to security incidents',
      steps: [
        {
          name: 'threat_assessment',
          type: 'agent_coordination',
          task_type: 'security',
          strategy: 'capability_based',
          priority: 'critical',
          required: true
        },
        {
          name: 'incident_notification',
          type: 'message_broadcast',
          message: { type: 'security_alert', severity: 'high' },
          recipients: ['admin', 'security_team'],
          required: true
        },
        {
          name: 'automated_response',
          type: 'agent_coordination',
          task_type: 'incident_response',
          strategy: 'response_time',
          priority: 'critical',
          required: false
        }
      ]
    });

    // Multi-language content processing workflow
    this.workflowEngine.workflowTemplates.set('multilingual_processing', {
      name: 'Multilingual Content Processing',
      description: 'Process content in multiple languages',
      steps: [
        {
          name: 'language_detection',
          type: 'agent_coordination',
          task_type: 'translation',
          strategy: 'capability_based',
          required: true
        },
        {
          name: 'content_translation',
          type: 'agent_coordination',
          task_type: 'translation',
          strategy: 'round_robin',
          required: true
        },
        {
          name: 'quality_analysis',
          type: 'agent_coordination',
          task_type: 'analytics',
          strategy: 'least_connections',
          required: false
        }
      ]
    });
  }

  initializeOptimizationRules() {
    this.systemOptimizer.optimizationRules.set('high_response_time', {
      condition: (metrics) => metrics.average_response_time > 5000,
      action: 'redistribute_load',
      priority: 'high'
    });

    this.systemOptimizer.optimizationRules.set('agent_overload', {
      condition: (metrics) => metrics.max_agent_load > 90,
      action: 'scale_agents',
      priority: 'medium'
    });

    this.systemOptimizer.optimizationRules.set('low_success_rate', {
      condition: (metrics) => metrics.success_rate < 95,
      action: 'health_check_agents',
      priority: 'high'
    });
  }

  startHealthMonitoring() {
    setInterval(() => {
      this.performHealthChecks();
    }, this.healthMonitor.checkInterval);
  }

  async performHealthChecks() {
    for (const [agentId, agent] of this.agentRegistry) {
      try {
        const healthResult = await this.checkAgentHealth(agent);
        this.updateAgentHealth(agentId, healthResult);
        this.coordinationMetrics.health_checks_performed++;
      } catch (error) {
        console.error(`[MCPCoordinatorAgent] Health check failed for ${agentId}:`, error);
        this.markAgentUnhealthy(agentId);
      }
    }
  }

  async checkAgentHealth(agent) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Health check timeout'));
      }, 5000);

      const healthMessage = new MCPMessage({
        type: 'QUERY',
        sender: this.agentId,
        recipient: agent.id,
        payload: { query_type: 'status' }
      });

      const responseHandler = (message) => {
        if (message.metadata?.response_to === healthMessage.id) {
          clearTimeout(timeout);
          MessageBus.removeListener('mcp:message', responseHandler);
          resolve(message.payload);
        }
      };

      MessageBus.on('mcp:message', responseHandler);
      MessageBus.sendMessage(healthMessage);
    });
  }

  updateAgentHealth(agentId, healthResult) {
    const agent = this.agentRegistry.get(agentId);
    if (!agent) return;

    agent.last_seen = new Date().toISOString();
    agent.health_score = this.calculateHealthScore(healthResult);
    
    // Update health history
    if (!this.healthMonitor.healthHistory.has(agentId)) {
      this.healthMonitor.healthHistory.set(agentId, []);
    }
    
    const history = this.healthMonitor.healthHistory.get(agentId);
    history.push({
      timestamp: new Date().toISOString(),
      health_score: agent.health_score,
      status: healthResult.status
    });

    // Keep only last 100 entries
    if (history.length > 100) {
      history.splice(0, history.length - 50);
    }
  }

  markAgentUnhealthy(agentId) {
    const agent = this.agentRegistry.get(agentId);
    if (!agent) return;

    agent.health_score -= 20;
    if (agent.health_score <= 0) {
      agent.status = 'unhealthy';
      console.warn(`[MCPCoordinatorAgent] Agent ${agentId} marked as unhealthy`);
    }
  }

  calculateHealthScore(healthResult) {
    let score = 100;
    
    if (healthResult.status !== 'active') score -= 30;
    if (healthResult.metrics?.errors > 0) score -= 20;
    if (healthResult.metrics?.average_response_time > 5000) score -= 15;
    
    return Math.max(0, score);
  }

  startSystemOptimization() {
    setInterval(() => {
      if (this.systemOptimizer.autoOptimize) {
        this.performSystemOptimization();
      }
    }, 60000); // Every minute
  }

  async performSystemOptimization() {
    const systemMetrics = this.calculateSystemMetrics();
    
    for (const [ruleName, rule] of this.systemOptimizer.optimizationRules) {
      if (rule.condition(systemMetrics)) {
        console.log(`[MCPCoordinatorAgent] Optimization rule triggered: ${ruleName}`);
        await this.executeOptimizationAction(rule.action, systemMetrics);
        this.coordinationMetrics.system_optimizations++;
      }
    }
  }

  calculateSystemMetrics() {
    const agents = Array.from(this.agentRegistry.values());
    
    return {
      total_agents: agents.length,
      active_agents: agents.filter(a => a.status === 'active').length,
      average_response_time: agents.reduce((sum, a) => sum + (a.performance_metrics.response_time || 0), 0) / agents.length,
      max_agent_load: Math.max(...agents.map(a => a.performance_metrics.load || 0)),
      success_rate: this.coordinationMetrics.requests_successful / Math.max(1, this.coordinationMetrics.requests_processed) * 100,
      average_health_score: agents.reduce((sum, a) => sum + a.health_score, 0) / agents.length
    };
  }

  updateCoordinationMetrics(coordinationTime) {
    if (this.coordinationMetrics.average_coordination_time === 0) {
      this.coordinationMetrics.average_coordination_time = coordinationTime;
    } else {
      this.coordinationMetrics.average_coordination_time = 
        (this.coordinationMetrics.average_coordination_time + coordinationTime) / 2;
    }
  }

  updateRoutingTable() {
    // Rebuild routing table based on current agent registry
    this.loadBalancer.routingTable.clear();
    
    for (const [agentId, agent] of this.agentRegistry) {
      if (agent.status === 'active' && agent.capabilities) {
        agent.capabilities.forEach(capability => {
          if (!this.loadBalancer.routingTable.has(capability)) {
            this.loadBalancer.routingTable.set(capability, []);
          }
          this.loadBalancer.routingTable.get(capability).push(agentId);
        });
      }
    }
  }

  generateCoordinationId() {
    return `coord_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  generateWorkflowId() {
    return `workflow_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  healthCheck() {
    return {
      status: this.status,
      agentId: this.agentId,
      capabilities: this.capabilities,
      metrics: {
        messages_routed: this.coordinationMetrics.messages_routed,
        agents_coordinated: this.coordinationMetrics.agents_coordinated,
        workflows_orchestrated: this.coordinationMetrics.workflows_orchestrated,
        load_balancing_decisions: this.coordinationMetrics.load_balancing_decisions,
        health_checks_performed: this.coordinationMetrics.health_checks_performed,
        system_optimizations: this.coordinationMetrics.system_optimizations,
        average_coordination_time: Math.round(this.coordinationMetrics.average_coordination_time)
      },
      system_status: {
        registered_agents: this.agentRegistry.size,
        active_agents: Array.from(this.agentRegistry.values()).filter(a => a.status === 'active').length,
        active_workflows: this.workflowEngine.activeWorkflows.size,
        routing_entries: this.loadBalancer.routingTable.size,
        load_balancing_strategy: this.loadBalancer.currentStrategy
      },
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = new MCPCoordinatorAgent();