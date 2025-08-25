/**
 * @fileoverview Task Router - Routes tasks to appropriate agents
 */
import { Logger } from '../../core/index.js';
export class TaskRouter {
  logger;
  routingRules = [
    { taskType: 'research.web.search', agentType: 'research', priority: 1 },
    { taskType: 'research.web.scrape', agentType: 'research', priority: 1 },
    { taskType: 'writer.content.create', agentType: 'writer', priority: 1 },
    { taskType: 'writer.content.edit', agentType: 'writer', priority: 1 },
    {
      taskType: 'codewriter.generate.function',
      agentType: 'codewriter',
      priority: 1,
    },
    {
      taskType: 'codewriter.refactor.code',
      agentType: 'codewriter',
      priority: 1,
    },
    { taskType: 'analytics.data.query', agentType: 'analytics', priority: 1 },
    {
      taskType: 'analytics.report.generate',
      agentType: 'analytics',
      priority: 1,
    },
    {
      taskType: 'langchain.agent.execute',
      agentType: 'langchain',
      priority: 1,
    },
    {
      taskType: 'huggingface.text.generation',
      agentType: 'huggingface',
      priority: 1,
    },
  ];
  constructor() {
    this.logger = Logger.create('TaskRouter');
  }
  /**
   * Route task to appropriate agent type
   */
  routeTask(request) {
    const rule = this.routingRules.find(
      rule => rule.taskType === request.taskType
    );
    if (rule) {
      this.logger.debug('Task routed', {
        taskType: request.taskType,
        agentType: rule.agentType,
        priority: rule.priority,
      });
      return rule.agentType;
    }
    // Default routing based on task type patterns
    if (request.taskType.startsWith('research.')) return 'research';
    if (request.taskType.startsWith('writer.')) return 'writer';
    if (request.taskType.startsWith('codewriter.')) return 'codewriter';
    if (request.taskType.startsWith('analytics.')) return 'analytics';
    if (request.taskType.startsWith('langchain.')) return 'langchain';
    if (request.taskType.startsWith('huggingface.')) return 'huggingface';
    this.logger.warn('No specific routing rule found, using default', {
      taskType: request.taskType,
    });
    return 'default';
  }
  /**
   * Add custom routing rule
   */
  addRule(rule) {
    this.routingRules.push(rule);
    this.routingRules.sort((a, b) => b.priority - a.priority);
    this.logger.debug('Routing rule added', rule);
  }
  /**
   * Get all routing rules
   */
  getRules() {
    return [...this.routingRules];
  }
  /**
   * Check if agent can handle task based on requirements
   */
  checkRequirements(rule, agentCapabilities) {
    if (!rule.requirements) return true;
    const { minMemory, maxLatency, requiresGPU } = rule.requirements;
    if (minMemory && agentCapabilities.memory < minMemory) return false;
    if (maxLatency && agentCapabilities.latency > maxLatency) return false;
    if (requiresGPU && !agentCapabilities.hasGPU) return false;
    return true;
  }
}
