// packages/backend/src/system/SupervisorRegistry.js

/**
 * SupervisorRegistry - Hierarchical Agent Management System
 *
 * Manages the hierarchical structure of agents with category-based supervisors
 * following LangChain model rule-sets for coordination and delegation.
 */

import { StateGraph, START, MemorySaver } from '@langchain/langgraph';
import { BaseMessage, HumanMessage, AIMessage } from '@langchain/core/messages';
import { z } from 'zod';

// Define agent categories and their supervisors
const AGENT_CATEGORIES = {
  'System & Orchestration': {
    supervisor: 'MCPCoordinatorAgent',
    agents: ['MCPCoordinatorAgent'],
  },
  Consciousness: {
    supervisor: 'EnhancedLangChainCoreAgent', // Main supervisor
    agents: [
      'CodeWriterAgent',
      'SchedulerAgent',
      'ArtistAgent',
      'WriterAgent',
      'ResearcherAgent',
      'ComedianAgent',
      'EmotionalIntelligenceAgent',
      'TaskManagementAgent',
      'AnalyticsAgent',
      'DesignAgent',
      'PersonalizationAgent',
      'GitHubSearchAgent',
      'ToolAgent',
      'MultiModalFusionAgent',
    ],
  },
  'Ethics & Safety': {
    supervisor: 'SecurityAuditAgent',
    agents: [
      'ConstitutionalAI',
      'ExistentialCheckIn',
      'PrivacyProtectionAgent',
      'BiasDetectionAgent',
      'SecurityAuditAgent',
    ],
  },
  'Memory & Learning': {
    supervisor: 'KnowledgeGraphAgent',
    agents: [
      'ConversationStore',
      'UserProfile',
      'KnowledgeGraphAgent',
      'LearningAdapterAgent',
      'ContextMemoryAgent',
    ],
  },
  'Communication & Integration': {
    supervisor: 'TranslationAgent',
    agents: ['NotificationAgent', 'TranslationAgent', 'APIGatewayAgent'],
  },
};

// Define the supervisor state schema
const SupervisorState = z.object({
  messages: z.array(z.any()),
  current_category: z.string().optional(),
  delegated_agent: z.string().optional(),
  task_context: z.any().optional(),
  supervisor_decisions: z.array(z.string()).default([]),
  coordination_history: z.array(z.any()).default([]),
});

class SupervisorRegistry {
  constructor() {
    this.categories = AGENT_CATEGORIES;
    this.supervisors = new Map();
    this.subordinates = new Map();
    this.agentInstances = new Map();
    this.stateGraph = null;
    this.memory = new MemorySaver();

    this.initializeHierarchy();
    this.buildCoordinationGraph();
  }

  initializeHierarchy() {
    // Build supervisor-subordinate relationships
    for (const [categoryName, categoryInfo] of Object.entries(
      this.categories
    )) {
      const supervisorName = categoryInfo.supervisor;

      // Register supervisor
      this.supervisors.set(supervisorName, {
        category: categoryName,
        subordinates: categoryInfo.agents.filter(
          agent => agent !== supervisorName
        ),
        responsibilities: this.getResponsibilities(categoryName),
      });

      // Register subordinates
      for (const agentName of categoryInfo.agents) {
        if (agentName !== supervisorName) {
          this.subordinates.set(agentName, {
            supervisor: supervisorName,
            category: categoryName,
          });
        }
      }
    }

    console.log('[SupervisorRegistry] Hierarchical structure initialized');
    console.log(`[SupervisorRegistry] Supervisors: ${this.supervisors.size}`);
    console.log(`[SupervisorRegistry] Subordinates: ${this.subordinates.size}`);
  }

  buildCoordinationGraph() {
    // Create LangChain StateGraph for hierarchical coordination
    const workflow = new StateGraph(SupervisorState);

    // Add supervisor nodes
    for (const supervisorName of this.supervisors.keys()) {
      workflow.addNode(
        supervisorName,
        this.createSupervisorNode(supervisorName)
      );
    }

    // Add coordination logic
    workflow.addNode('route_request', this.routeRequest.bind(this));
    workflow.addNode('coordinate_response', this.coordinateResponse.bind(this));

    // Define workflow edges
    workflow.addEdge(START, 'route_request');

    // Conditional routing to appropriate supervisor
    workflow.addConditionalEdges(
      'route_request',
      this.determineSupervisor.bind(this),
      Object.fromEntries(
        Array.from(this.supervisors.keys()).map(name => [name, name])
      )
    );

    // All supervisors route to coordination
    for (const supervisorName of this.supervisors.keys()) {
      workflow.addEdge(supervisorName, 'coordinate_response');
    }

    this.stateGraph = workflow.compile({ checkpointer: this.memory });
    console.log('[SupervisorRegistry] Coordination graph compiled');
  }

  createSupervisorNode(supervisorName) {
    return async state => {
      const supervisor = this.supervisors.get(supervisorName);
      const agentInstance = this.getAgentInstance(supervisorName);

      console.log(`[SupervisorRegistry] ${supervisorName} processing request`);

      // Supervisor decision logic
      const decision = await this.makeSupervisorDecision(supervisorName, state);

      // Update state with supervisor decisions
      return {
        ...state,
        current_category: supervisor.category,
        supervisor_decisions: [...state.supervisor_decisions, decision.action],
        coordination_history: [
          ...state.coordination_history,
          {
            supervisor: supervisorName,
            timestamp: new Date().toISOString(),
            decision: decision,
          },
        ],
      };
    };
  }

  async makeSupervisorDecision(supervisorName, state) {
    const supervisor = this.supervisors.get(supervisorName);
    const task = state.task_context;

    // Supervisor decision-making rules
    const rules = this.getSupervisorRules(supervisorName);

    // Apply LangChain-style rule evaluation
    for (const rule of rules) {
      if (await rule.condition(task, state)) {
        console.log(
          `[SupervisorRegistry] ${supervisorName} applying rule: ${rule.name}`
        );
        return await rule.action(task, state);
      }
    }

    // Default delegation to most capable subordinate
    return {
      action: 'delegate',
      target: this.selectBestSubordinate(supervisorName, task),
      reasoning: 'Default delegation based on capability match',
    };
  }

  getSupervisorRules(supervisorName) {
    const commonRules = [
      {
        name: 'high_priority_escalation',
        condition: async (task, state) => task?.priority === 'critical',
        action: async (task, state) => ({
          action: 'escalate',
          target: 'EnhancedLangChainCoreAgent',
          reasoning: 'Critical priority requires main supervisor attention',
        }),
      },
      {
        name: 'capability_match',
        condition: async (task, state) => task?.requiredCapability,
        action: async (task, state) => {
          const bestAgent = this.findAgentByCapability(
            supervisorName,
            task.requiredCapability
          );
          return {
            action: 'delegate',
            target: bestAgent,
            reasoning: `Agent ${bestAgent} has required capability: ${task.requiredCapability}`,
          };
        },
      },
      {
        name: 'supervisor_direct_handling',
        condition: async (task, state) => {
          const supervisor = this.supervisors.get(supervisorName);
          return supervisor.responsibilities.includes(task?.type);
        },
        action: async (task, state) => ({
          action: 'handle_directly',
          reasoning: 'Task falls under supervisor direct responsibility',
        }),
      },
    ];

    // Category-specific rules
    const categoryRules = this.getCategorySpecificRules(supervisorName);

    return [...commonRules, ...categoryRules];
  }

  getCategorySpecificRules(supervisorName) {
    const supervisor = this.supervisors.get(supervisorName);

    switch (supervisor.category) {
      case 'System & Orchestration':
        return [
          {
            name: 'system_coordination',
            condition: async (task, state) =>
              task?.type === 'system_coordination',
            action: async (task, state) => ({
              action: 'coordinate_system',
              reasoning: 'System coordination requires orchestrator attention',
            }),
          },
        ];

      case 'Ethics & Safety':
        return [
          {
            name: 'safety_override',
            condition: async (task, state) =>
              task?.safety_concern || task?.ethical_issue,
            action: async (task, state) => ({
              action: 'safety_review',
              reasoning: 'Safety or ethical concerns require immediate review',
            }),
          },
        ];

      case 'Memory & Learning':
        return [
          {
            name: 'knowledge_integration',
            condition: async (task, state) => task?.type === 'knowledge_update',
            action: async (task, state) => ({
              action: 'integrate_knowledge',
              reasoning: 'Knowledge updates require graph integration',
            }),
          },
        ];

      default:
        return [];
    }
  }

  routeRequest(state) {
    const task = state.task_context;
    const category = this.determineTaskCategory(task);

    console.log(
      `[SupervisorRegistry] Routing request to category: ${category}`
    );

    return {
      ...state,
      current_category: category,
    };
  }

  determineSupervisor(state) {
    const category = state.current_category;
    const supervisorName = this.categories[category]?.supervisor;

    if (!supervisorName) {
      console.warn(
        `[SupervisorRegistry] No supervisor found for category: ${category}`
      );
      return 'EnhancedLangChainCoreAgent'; // Default to main supervisor
    }

    return supervisorName;
  }

  coordinateResponse(state) {
    console.log('[SupervisorRegistry] Coordinating final response');

    return {
      ...state,
      messages: [
        ...state.messages,
        new AIMessage({
          content: `Task coordinated by ${state.current_category} supervisor`,
          additional_kwargs: {
            coordination_history: state.coordination_history,
            supervisor_decisions: state.supervisor_decisions,
          },
        }),
      ],
    };
  }

  determineTaskCategory(task) {
    if (!task) return 'Consciousness'; // Default category

    // Task type to category mapping
    const taskCategoryMap = {
      system_coordination: 'System & Orchestration',
      agent_orchestration: 'System & Orchestration',
      security_audit: 'Ethics & Safety',
      privacy_check: 'Ethics & Safety',
      bias_detection: 'Ethics & Safety',
      knowledge_update: 'Memory & Learning',
      context_management: 'Memory & Learning',
      translation: 'Communication & Integration',
      notification: 'Communication & Integration',
      api_gateway: 'Communication & Integration',
    };

    return taskCategoryMap[task.type] || 'Consciousness';
  }

  findAgentByCapability(supervisorName, capability) {
    const supervisor = this.supervisors.get(supervisorName);
    if (!supervisor) return null;

    // Find subordinate with matching capability
    for (const agentName of supervisor.subordinates) {
      const agent = this.getAgentInstance(agentName);
      if (agent && agent.hasCapability && agent.hasCapability(capability)) {
        return agentName;
      }
    }

    return supervisor.subordinates[0]; // Fallback to first subordinate
  }

  selectBestSubordinate(supervisorName, task) {
    const supervisor = this.supervisors.get(supervisorName);
    if (!supervisor || supervisor.subordinates.length === 0) {
      return null;
    }

    // Simple selection based on task requirements
    if (task?.requiredCapability) {
      return this.findAgentByCapability(
        supervisorName,
        task.requiredCapability
      );
    }

    // Default to first available subordinate
    return supervisor.subordinates[0];
  }

  getResponsibilities(categoryName) {
    const responsibilityMap = {
      'System & Orchestration': [
        'system_coordination',
        'agent_orchestration',
        'load_balancing',
      ],
      Consciousness: [
        'task_execution',
        'creative_work',
        'analysis',
        'problem_solving',
      ],
      'Ethics & Safety': [
        'safety_checks',
        'ethical_review',
        'privacy_protection',
        'bias_detection',
      ],
      'Memory & Learning': [
        'knowledge_management',
        'learning_adaptation',
        'context_preservation',
      ],
      'Communication & Integration': [
        'external_communication',
        'api_integration',
        'notifications',
      ],
    };

    return responsibilityMap[categoryName] || [];
  }

  registerAgentInstance(agentName, instance) {
    this.agentInstances.set(agentName, instance);
    console.log(`[SupervisorRegistry] Registered agent instance: ${agentName}`);
  }

  getAgentInstance(agentName) {
    return this.agentInstances.get(agentName);
  }

  getSupervisor(agentName) {
    return this.subordinates.get(agentName)?.supervisor;
  }

  getSubordinates(supervisorName) {
    return this.supervisors.get(supervisorName)?.subordinates || [];
  }

  async processTask(task, sessionId = 'default') {
    const initialState = {
      messages: [
        new HumanMessage({
          content: task.description || 'Task execution request',
        }),
      ],
      task_context: task,
      supervisor_decisions: [],
      coordination_history: [],
    };

    const result = await this.stateGraph.invoke(initialState, {
      configurable: { thread_id: sessionId },
    });

    return result;
  }

  getHierarchyStatus() {
    return {
      categories: Object.keys(this.categories),
      supervisors: Array.from(this.supervisors.keys()),
      total_agents: Array.from(this.subordinates.keys()).length,
      hierarchy_depth: 2, // Supervisor -> Subordinate
      registered_instances: this.agentInstances.size,
      timestamp: new Date().toISOString(),
    };
  }
}

export default new SupervisorRegistry();
