/**
 * @fileoverview Intelligence Supervisor (Tier-1)
 * Manages language processing, research, code generation, and analytical tasks
 * Orchestrates LangChain/LangGraph agents and HuggingFace integration
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { trace, context, SpanKind } from '@opentelemetry/api';
import {
  MCPInProcessTransport,
  Logger,
  MCPMessage,
  TaskRequest,
  TaskResponse,
  TaskStatus,
  MessageTypes,
  TaskTypes,
  MCPValidator,
  getMetrics,
  createPerformanceTimer
} from '../../core/index.js';
import { AgentRegistry } from './agents/agent-registry.js';
import { CostManager } from './cost/cost-manager.js';
import { QualityGate } from './quality/quality-gate.js';
import { ModelCache } from './cache/model-cache.js';
import { TaskRouter } from './routing/task-router.js';

export interface IntelligenceSupervisorConfig {
  supervisorId?: string;
  enableCaching?: boolean;
  enableQualityGates?: boolean;
  enableCostManagement?: boolean;
  maxConcurrentTasks?: number;
  defaultTimeout?: number;
  redis?: {
    host: string;
    port: number;
    password?: string;
  };
  openai?: {
    apiKey?: string;
    organization?: string;
  };
  huggingface?: {
    apiKey?: string;
  };
}

/**
 * Intelligence Supervisor - coordinates language and reasoning tasks
 */
export class IntelligenceSupervisor extends EventEmitter {
  private readonly logger: Logger;
  private readonly config: Required<IntelligenceSupervisorConfig>;
  private readonly transport: MCPInProcessTransport;
  private readonly agentRegistry: AgentRegistry;
  private readonly costManager: CostManager;
  private readonly qualityGate: QualityGate;
  private readonly modelCache: ModelCache;
  private readonly taskRouter: TaskRouter;
  private readonly tracer = trace.getTracer('intelligence-supervisor');
  private readonly metrics = getMetrics();

  private isInitialized = false;
  private activeTasks = new Map<string, TaskExecution>();

  constructor(config: IntelligenceSupervisorConfig = {}) {
    super();
    this.logger = Logger.create('IntelligenceSupervisor');
    this.config = {
      supervisorId: config.supervisorId ?? 'intelligence-supervisor',
      enableCaching: config.enableCaching ?? true,
      enableQualityGates: config.enableQualityGates ?? true,
      enableCostManagement: config.enableCostManagement ?? true,
      maxConcurrentTasks: config.maxConcurrentTasks ?? 10,
      defaultTimeout: config.defaultTimeout ?? 60000, // 60 seconds
      redis: {
        host: config.redis?.host ?? process.env.REDIS_HOST ?? 'redis',
        port: config.redis?.port ?? parseInt(process.env.REDIS_PORT || '6379'),
        password: config.redis?.password ?? process.env.REDIS_PASSWORD,
      },
      openai: {
        apiKey: config.openai?.apiKey ?? process.env.OPENAI_API_KEY,
        organization: config.openai?.organization ?? process.env.OPENAI_ORGANIZATION,
      },
      huggingface: {
        apiKey: config.huggingface?.apiKey ?? process.env.HUGGINGFACE_API_KEY,
      },
    };

    // Initialize components
    this.transport = MCPInProcessTransport.getInstance();
    this.agentRegistry = new AgentRegistry({
      openai: this.config.openai,
      database: {
        host: process.env.DB_HOST,
        port: parseInt(process.env.DB_PORT || '5432'),
        username: process.env.DB_USERNAME,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
      },
      searchEngines: {
        tavilyApiKey: process.env.TAVILY_API_KEY,
        serpApiKey: process.env.SERPAPI_API_KEY,
        gnewsApiKey: process.env.GNEWS_API_KEY,
      },
      services: {
        deepgramApiKey: process.env.DEEPGRAM_API_KEY,
        huggingfaceApiKey: this.config.huggingface.apiKey,
        wolframApiKey: process.env.WOLFRAM_API_KEY,
      },
    });
    this.costManager = new CostManager(this.config);
    this.qualityGate = new QualityGate();
    this.modelCache = new ModelCache(this.config.redis);
    this.taskRouter = new TaskRouter();

    this.logger.info('Intelligence Supervisor created', { supervisorId: this.config.supervisorId });
  }

  /**
   * Initialize the supervisor
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    const span = this.tracer.startSpan('intelligence.supervisor.initialize');

    try {
      this.logger.info('Initializing Intelligence Supervisor...');

      // Initialize components
      await this.agentRegistry.initialize();
      await this.costManager.initialize();
      await this.modelCache.initialize();
      
      // Register message handler with transport
      this.transport.registerHandler(this.config.supervisorId, this.handleMessage.bind(this));

      // Set up supported task types
      this.setupTaskRouting();

      this.isInitialized = true;
      span.setAttributes({ 'intelligence.supervisor.initialized': true });
      this.logger.info('Intelligence Supervisor initialized successfully');
    } catch (error) {
      span.recordException(error as Error);
      this.logger.error('Failed to initialize Intelligence Supervisor', error as Error);
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Handle incoming MCP messages
   */
  private async handleMessage(message: MCPMessage): Promise<void> {
    const span = this.tracer.startSpan('intelligence.supervisor.message', {
      kind: SpanKind.SERVER,
      attributes: {
        'mcp.message.id': message.id,
        'mcp.message.type': message.messageType,
        'mcp.message.sender': message.sender,
      },
    });

    try {
      switch (message.messageType) {
        case MessageTypes.TASK_REQUEST:
          await this.handleTaskRequest(message);
          break;
        case MessageTypes.TASK_CANCEL:
          await this.handleTaskCancel(message);
          break;
        case MessageTypes.HEALTH_CHECK:
          await this.handleHealthCheck(message);
          break;
        default:
          this.logger.warn('Unsupported message type', { messageType: message.messageType });
      }
    } catch (error) {
      span.recordException(error as Error);
      this.logger.error('Error handling message', error as Error, { messageId: message.id });
    } finally {
      span.end();
    }
  }

  /**
   * Handle task request
   */
  private async handleTaskRequest(message: MCPMessage): Promise<void> {
    const taskRequest = message.payload as TaskRequest;
    const timer = createPerformanceTimer(taskRequest.taskType, this.config.supervisorId);

    const span = this.tracer.startSpan('intelligence.supervisor.task', {
      attributes: {
        'task.id': taskRequest.taskId,
        'task.type': taskRequest.taskType,
        'task.priority': taskRequest.priority,
      },
    });

    try {
      // Validate task request
      const validation = MCPValidator.safeValidate(MCPValidator.validateTaskRequest, taskRequest);
      if (!validation.success) {
        throw new Error(`Invalid task request: ${validation.errors.join(', ')}`);
      }

      // Check if we support this task type
      if (!this.canHandleTask(taskRequest.taskType)) {
        throw new Error(`Unsupported task type: ${taskRequest.taskType}`);
      }

      // Check concurrency limits
      if (this.activeTasks.size >= this.config.maxConcurrentTasks) {
        throw new Error('Maximum concurrent tasks reached');
      }

      // Check cost budget if enabled
      if (this.config.enableCostManagement) {
        await this.costManager.validateBudget(message.context.budget);
      }

      // Check cache if enabled
      let cachedResult: TaskResponse | null = null;
      if (this.config.enableCaching) {
        cachedResult = await this.modelCache.get(taskRequest);
      }

      if (cachedResult) {
        // Return cached result
        await this.sendTaskResponse(message, cachedResult);
        timer.complete();
        this.logger.info('Task completed from cache', { taskId: taskRequest.taskId });
        return;
      }

      // Create task execution
      const execution: TaskExecution = {
        taskId: taskRequest.taskId,
        request: taskRequest,
        startTime: Date.now(),
        status: 'running',
        span,
      };
      this.activeTasks.set(taskRequest.taskId, execution);

      // Route to appropriate agent
      const result = await this.executeTask(taskRequest, message.context);

      // Apply quality gates if enabled
      if (this.config.enableQualityGates) {
        await this.qualityGate.validate(result);
      }

      // Cache result if successful
      if (this.config.enableCaching && result.status === TaskStatus.COMPLETED) {
        await this.modelCache.set(taskRequest, result);
      }

      // Update cost tracking
      if (this.config.enableCostManagement && result.metrics) {
        await this.costManager.recordCost(result.metrics);
      }

      // Send response
      await this.sendTaskResponse(message, result);
      
      execution.status = 'completed';
      timer.complete();

      this.metrics.recordTaskCompleted(
        taskRequest.taskType,
        this.config.supervisorId,
        (Date.now() - execution.startTime) / 1000
      );

      this.logger.info('Task completed successfully', { 
        taskId: taskRequest.taskId,
        duration: Date.now() - execution.startTime,
      });

    } catch (error) {
      timer.fail((error as Error).message);
      
      const errorResponse: TaskResponse = {
        taskId: taskRequest.taskId,
        status: TaskStatus.FAILED,
        errorMessage: (error as Error).message,
        errorCode: 'INTELLIGENCE_SUPERVISOR_ERROR',
        metrics: {
          processingTimeMs: Date.now() - (this.activeTasks.get(taskRequest.taskId)?.startTime || Date.now()),
          queueTimeMs: 0,
          retryCount: 0,
          costUsd: 0,
          tokensUsed: 0,
          customMetrics: {},
        },
        warnings: [],
      };

      await this.sendTaskResponse(message, errorResponse);

      this.metrics.recordTaskFailed(
        taskRequest.taskType,
        this.config.supervisorId,
        (Date.now() - (this.activeTasks.get(taskRequest.taskId)?.startTime || Date.now())) / 1000,
        'SUPERVISOR_ERROR'
      );

      span.recordException(error as Error);
      this.logger.error('Task execution failed', error as Error, { taskId: taskRequest.taskId });
    } finally {
      this.activeTasks.delete(taskRequest.taskId);
      span.end();
    }
  }

  /**
   * Execute a task using the appropriate agent
   */
  private async executeTask(request: TaskRequest, mcpContext: any): Promise<TaskResponse> {
    const span = this.tracer.startSpan('intelligence.supervisor.execute', {
      attributes: {
        'task.type': request.taskType,
      },
    });

    try {
      // Execute with the agent registry
      const result = await this.agentRegistry.executeTask(request, mcpContext);

      this.logger.info('Task executed successfully', { 
        taskId: request.taskId,
        taskType: request.taskType,
      });

      span.setAttributes({
        'task.success': true,
      });

      return result;
    } catch (error) {
      span.recordException(error as Error);
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Send task response back to sender
   */
  private async sendTaskResponse(originalMessage: MCPMessage, response: TaskResponse): Promise<void> {
    const responseMessage: MCPMessage = {
      id: uuidv4(),
      correlationId: originalMessage.id,
      traceId: originalMessage.traceId,
      spanId: uuidv4(),
      sender: this.config.supervisorId,
      recipient: originalMessage.sender,
      messageType: MessageTypes.TASK_RESPONSE,
      payload: response,
      tags: [],
      context: originalMessage.context,
      delivery: {
        guarantee: 'AT_LEAST_ONCE',
        retryCount: 3,
        retryDelayMs: 1000,
        requireAck: true,
        priority: 5,
      },
      createdAt: new Date(),
      permissions: [],
    };

    await this.transport.sendMessage(responseMessage);
  }

  /**
   * Handle task cancellation
   */
  private async handleTaskCancel(message: MCPMessage): Promise<void> {
    const taskId = message.payload.taskId;
    const execution = this.activeTasks.get(taskId);
    
    if (execution) {
      execution.status = 'cancelled';
      this.activeTasks.delete(taskId);
      
      const response: TaskResponse = {
        taskId,
        status: TaskStatus.CANCELLED,
        metrics: {
          processingTimeMs: Date.now() - execution.startTime,
          queueTimeMs: 0,
          retryCount: 0,
          costUsd: 0,
          tokensUsed: 0,
          customMetrics: {},
        },
        warnings: [],
      };

      await this.sendTaskResponse(message, response);
      this.logger.info('Task cancelled', { taskId });
    }
  }

  /**
   * Handle health check
   */
  private async handleHealthCheck(message: MCPMessage): Promise<void> {
    const health = {
      supervisorId: this.config.supervisorId,
      status: 'healthy',
      activeTasks: this.activeTasks.size,
      maxConcurrentTasks: this.config.maxConcurrentTasks,
      agentRegistry: this.agentRegistry.getStats(),
      uptime: process.uptime(),
    };

    const response: MCPMessage = {
      id: uuidv4(),
      correlationId: message.id,
      traceId: message.traceId,
      spanId: uuidv4(),
      sender: this.config.supervisorId,
      recipient: message.sender,
      messageType: 'HEALTH_RESPONSE',
      payload: health,
      tags: [],
      context: message.context,
      delivery: message.delivery,
      createdAt: new Date(),
      permissions: [],
    };

    await this.transport.sendMessage(response);
  }

  /**
   * Check if this supervisor can handle a task type
   */
  private canHandleTask(taskType: string): boolean {
    const supportedTypes = [
      TaskTypes['langchain.agent.execute'],
      TaskTypes['langchain.chat.execute'],
      TaskTypes['langchain.react.execute'],
      TaskTypes['huggingface.text.generation'],
      TaskTypes['huggingface.text.classification'],
      TaskTypes['huggingface.text.summarization'],
      TaskTypes['huggingface.text.translation'],
      TaskTypes['huggingface.text.question_answering'],
      TaskTypes['research.web.search'],
      TaskTypes['research.web.scrape'],
      TaskTypes['writer.compose'],
      TaskTypes['codewriter.generate'],
      TaskTypes['analytics.run_query'],
    ];

    return supportedTypes.includes(taskType as any);
  }

  /**
   * Set up task routing
   */
  private setupTaskRouting(): void {
    // Configure routing rules for different task types
    this.taskRouter.addRoute(TaskTypes['langchain.agent.execute'], 'langchain-executor');
    this.taskRouter.addRoute(TaskTypes['langchain.chat.execute'], 'chat-agent');
    this.taskRouter.addRoute(TaskTypes['langchain.react.execute'], 'react-agent');
    this.taskRouter.addRoute(TaskTypes['huggingface.text.generation'], 'language-maestro');
    this.taskRouter.addRoute(TaskTypes['huggingface.text.classification'], 'language-maestro');
    this.taskRouter.addRoute(TaskTypes['research.web.search'], 'researcher');
    this.taskRouter.addRoute(TaskTypes['writer.compose'], 'writer');
    this.taskRouter.addRoute(TaskTypes['codewriter.generate'], 'codewriter');
    this.taskRouter.addRoute(TaskTypes['analytics.run_query'], 'analytics');
  }

  /**
   * Get supervisor statistics
   */
  getStats() {
    return {
      supervisorId: this.config.supervisorId,
      activeTasks: this.activeTasks.size,
      maxConcurrentTasks: this.config.maxConcurrentTasks,
      initialized: this.isInitialized,
      supportedTaskTypes: this.getSupportedTaskTypes(),
    };
  }

  /**
   * Get supported task types
   */
  private getSupportedTaskTypes(): string[] {
    return [
      TaskTypes['langchain.agent.execute'],
      TaskTypes['langchain.chat.execute'],
      TaskTypes['langchain.react.execute'],
      TaskTypes['huggingface.text.generation'],
      TaskTypes['huggingface.text.classification'],
      TaskTypes['huggingface.text.summarization'],
      TaskTypes['huggingface.text.translation'],
      TaskTypes['huggingface.text.question_answering'],
      TaskTypes['research.web.search'],
      TaskTypes['research.web.scrape'],
      TaskTypes['writer.compose'],
      TaskTypes['codewriter.generate'],
      TaskTypes['analytics.run_query'],
    ];
  }

  /**
   * Shutdown the supervisor
   */
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down Intelligence Supervisor...');
    
    // Cancel all active tasks
    for (const [, execution] of this.activeTasks) {
      execution.status = 'cancelled';
    }
    this.activeTasks.clear();

    // Shutdown components
    await this.agentRegistry.shutdown();
    await this.modelCache.shutdown();

    this.removeAllListeners();
    this.logger.info('Intelligence Supervisor shutdown complete');
  }
}

interface TaskExecution {
  taskId: string;
  request: TaskRequest;
  startTime: number;
  status: 'running' | 'completed' | 'cancelled';
  span: any;
}

export default IntelligenceSupervisor;