/**
 * @fileoverview Multi-Modal Supervisor (Tier-1)
 * Manages vision, audio, and sensor fusion tasks
 * Orchestrates Deepgram, OpenAI Vision, HuggingFace multi-modal models
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
import { MultiModalAgentPool } from './agents/multimodal-pool.js';
import { StreamManager } from './streaming/stream-manager.js';
import { SensorFusion } from './fusion/sensor-fusion.js';
import { MediaProcessor } from './processing/media-processor.js';

export interface MultiModalSupervisorConfig {
  supervisorId?: string;
  enableStreaming?: boolean;
  enableSensorFusion?: boolean;
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
  deepgram?: {
    apiKey?: string;
  };
  huggingface?: {
    apiKey?: string;
  };
}

/**
 * Multi-Modal Supervisor - coordinates vision, audio, and sensor fusion tasks
 */
export class MultiModalSupervisor extends EventEmitter {
  private readonly logger: Logger;
  private readonly config: Required<MultiModalSupervisorConfig>;
  private readonly transport: MCPInProcessTransport;
  private readonly agentPool: MultiModalAgentPool;
  private readonly streamManager: StreamManager;
  private readonly sensorFusion: SensorFusion;
  private readonly mediaProcessor: MediaProcessor;
  private readonly tracer = trace.getTracer('multimodal-supervisor');
  private readonly metrics = getMetrics();

  private isInitialized = false;
  private activeTasks = new Map<string, TaskExecution>();
  private activeStreams = new Map<string, StreamSession>();

  constructor(config: MultiModalSupervisorConfig = {}) {
    super();
    this.logger = Logger.create('MultiModalSupervisor');
    this.config = {
      supervisorId: config.supervisorId ?? 'multimodal-supervisor',
      enableStreaming: config.enableStreaming ?? true,
      enableSensorFusion: config.enableSensorFusion ?? true,
      maxConcurrentTasks: config.maxConcurrentTasks ?? 8,
      defaultTimeout: config.defaultTimeout ?? 45000, // 45 seconds
      redis: {
        host: config.redis?.host ?? process.env.REDIS_HOST ?? 'redis',
        port: config.redis?.port ?? parseInt(process.env.REDIS_PORT || '6379'),
        password: config.redis?.password ?? process.env.REDIS_PASSWORD,
      },
      openai: {
        apiKey: config.openai?.apiKey ?? process.env.OPENAI_API_KEY,
        organization: config.openai?.organization ?? process.env.OPENAI_ORGANIZATION,
      },
      deepgram: {
        apiKey: config.deepgram?.apiKey ?? process.env.DEEPGRAM_API_KEY,
      },
      huggingface: {
        apiKey: config.huggingface?.apiKey ?? process.env.HUGGINGFACE_API_KEY,
      },
    };

    // Initialize components
    this.transport = MCPInProcessTransport.getInstance();
    this.agentPool = new MultiModalAgentPool();
    this.streamManager = new StreamManager(this.config);
    this.sensorFusion = new SensorFusion();
    this.mediaProcessor = new MediaProcessor();

    this.logger.info('Multi-Modal Supervisor created', { supervisorId: this.config.supervisorId });
  }

  /**
   * Initialize the supervisor
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    const span = this.tracer.startSpan('multimodal.supervisor.initialize');

    try {
      this.logger.info('Initializing Multi-Modal Supervisor...');

      // Initialize components
      await this.agentPool.initialize(this.config);
      await this.streamManager.initialize();
      await this.sensorFusion.initialize();
      await this.mediaProcessor.initialize();

      // Register message handler with transport
      this.transport.registerHandler(this.config.supervisorId, this.handleMessage.bind(this));

      // Set up streaming handlers
      if (this.config.enableStreaming) {
        this.setupStreamingHandlers();
      }

      this.isInitialized = true;
      span.setAttributes({ 'multimodal.supervisor.initialized': true });
      this.logger.info('Multi-Modal Supervisor initialized successfully');
    } catch (error) {
      span.recordException(error as Error);
      this.logger.error('Failed to initialize Multi-Modal Supervisor', error as Error);
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Handle incoming MCP messages
   */
  private async handleMessage(message: MCPMessage): Promise<void> {
    const span = this.tracer.startSpan('multimodal.supervisor.message', {
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
        case MessageTypes.STREAM_START:
          await this.handleStreamStart(message);
          break;
        case MessageTypes.STREAM_DATA:
          await this.handleStreamData(message);
          break;
        case MessageTypes.STREAM_END:
          await this.handleStreamEnd(message);
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

    const span = this.tracer.startSpan('multimodal.supervisor.task', {
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

      // Pre-process media if needed
      const processedParameters = await this.preprocessMedia(taskRequest);

      // Create task execution
      const execution: TaskExecution = {
        taskId: taskRequest.taskId,
        request: { ...taskRequest, parameters: processedParameters },
        startTime: Date.now(),
        status: 'running',
        span,
      };
      this.activeTasks.set(taskRequest.taskId, execution);

      // Execute task
      const result = await this.executeTask(execution.request, message.context);

      // Post-process result if needed
      const finalResult = await this.postprocessResult(result, taskRequest.taskType);

      // Send response
      await this.sendTaskResponse(message, finalResult);

      execution.status = 'completed';
      timer.complete();

      this.metrics.recordTaskCompleted(
        taskRequest.taskType,
        this.config.supervisorId,
        (Date.now() - execution.startTime) / 1000
      );

      this.logger.info('Multi-modal task completed successfully', {
        taskId: taskRequest.taskId,
        duration: Date.now() - execution.startTime,
      });

    } catch (error) {
      timer.fail((error as Error).message);

      const errorResponse: TaskResponse = {
        taskId: taskRequest.taskId,
        status: TaskStatus.FAILED,
        errorMessage: (error as Error).message,
        errorCode: 'MULTIMODAL_SUPERVISOR_ERROR',
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

      span.recordException(error as Error);
      this.logger.error('Multi-modal task execution failed', error as Error, { taskId: taskRequest.taskId });
    } finally {
      this.activeTasks.delete(taskRequest.taskId);
      span.end();
    }
  }

  /**
   * Execute a task using the appropriate agent
   */
  private async executeTask(request: TaskRequest, mcpContext: any): Promise<TaskResponse> {
    const span = this.tracer.startSpan('multimodal.supervisor.execute', {
      attributes: {
        'task.type': request.taskType,
      },
    });

    try {
      // Route to appropriate agent based on task type
      const agent = await this.agentPool.getAvailableAgent(request.taskType);

      if (!agent) {
        throw new Error(`No available agent for task type: ${request.taskType}`);
      }

      this.logger.info('Routing multi-modal task to agent', {
        taskId: request.taskId,
        taskType: request.taskType,
        agentName: agent.name,
      });

      // Check if sensor fusion is needed
      if (this.config.enableSensorFusion && this.requiresSensorFusion(request.taskType)) {
        return await this.executeWithSensorFusion(request, agent, mcpContext);
      }

      // Execute with the selected agent
      const result = await agent.execute(request, mcpContext);

      span.setAttributes({
        'task.agent': agent.name,
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
   * Execute task with sensor fusion
   */
  private async executeWithSensorFusion(request: TaskRequest, agent: any, mcpContext: any): Promise<TaskResponse> {
    const span = this.tracer.startSpan('multimodal.supervisor.sensor_fusion');

    try {
      // Fuse sensor data
      const fusedData = await this.sensorFusion.fuse(request.parameters);

      // Update request with fused data
      const fusedRequest = {
        ...request,
        parameters: {
          ...request.parameters,
          fusedSensorData: fusedData,
        },
      };

      // Execute with fused data
      const result = await agent.execute(fusedRequest, mcpContext);

      span.setAttributes({
        'fusion.sensors_count': fusedData?.sensorsUsed?.length || 0,
        'fusion.success': true,
      });

      return result;
    } catch (error) {
      span.recordException(error as Error);
      throw new Error(`Sensor fusion failed: ${(error as Error).message}`);
    } finally {
      span.end();
    }
  }

  /**
   * Handle streaming start
   */
  private async handleStreamStart(message: MCPMessage): Promise<void> {
    if (!this.config.enableStreaming) {
      throw new Error('Streaming is disabled');
    }

    const streamStart = message.payload;
    const streamId = streamStart.streamId;

    this.logger.info('Starting multimodal stream', { streamId });

    const session: StreamSession = {
      streamId,
      startTime: Date.now(),
      sender: message.sender,
      contentType: streamStart.contentType,
      status: 'active',
      dataChunks: [],
    };

    this.activeStreams.set(streamId, session);
    await this.streamManager.startStream(streamId, streamStart);
  }

  /**
   * Handle streaming data
   */
  private async handleStreamData(message: MCPMessage): Promise<void> {
    const streamData = message.payload;
    const streamId = streamData.streamId;
    const session = this.activeStreams.get(streamId);

    if (!session) {
      this.logger.warn('Received data for unknown stream', { streamId });
      return;
    }

    session.dataChunks.push(streamData);
    await this.streamManager.processStreamChunk(streamId, streamData);

    // Process intermediate results for real-time feedback
    if (session.contentType?.includes('audio') && session.dataChunks.length % 10 === 0) {
      await this.processStreamingAudio(session);
    }
  }

  /**
   * Handle streaming end
   */
  private async handleStreamEnd(message: MCPMessage): Promise<void> {
    const streamEnd = message.payload;
    const streamId = streamEnd.streamId;
    const session = this.activeStreams.get(streamId);

    if (!session) {
      this.logger.warn('Received end for unknown stream', { streamId });
      return;
    }

    this.logger.info('Ending multimodal stream', { streamId });

    session.status = 'completed';
    const result = await this.streamManager.finalizeStream(streamId, streamEnd);

    // Send final result
    const response: MCPMessage = {
      id: uuidv4(),
      correlationId: message.id,
      traceId: message.traceId,
      spanId: uuidv4(),
      sender: this.config.supervisorId,
      recipient: session.sender,
      messageType: MessageTypes.STREAM_END,
      payload: {
        streamId,
        result,
        metadata: {
          duration: Date.now() - session.startTime,
          chunksProcessed: session.dataChunks.length,
        },
      },
      tags: [],
      context: message.context,
      delivery: message.delivery,
      createdAt: new Date(),
      permissions: [],
    };

    await this.transport.sendMessage(response);
    this.activeStreams.delete(streamId);
  }

  /**
   * Pre-process media data
   */
  private async preprocessMedia(request: TaskRequest): Promise<any> {
    const { parameters } = request;

    if (this.requiresMediaProcessing(request.taskType)) {
      return await this.mediaProcessor.process(parameters);
    }

    return parameters;
  }

  /**
   * Post-process results
   */
  private async postprocessResult(result: TaskResponse, taskType: string): Promise<TaskResponse> {
    if (this.requiresPostProcessing(taskType)) {
      // Add multimodal-specific metadata
      return {
        ...result,
        result: {
          ...result.result,
          multimodalMetadata: {
            supervisor: this.config.supervisorId,
            processingPipeline: this.getProcessingPipeline(taskType),
            timestamp: new Date().toISOString(),
          },
        },
      };
    }

    return result;
  }

  /**
   * Process streaming audio in real-time
   */
  private async processStreamingAudio(session: StreamSession): Promise<void> {
    try {
      // Get recent audio chunks
      const recentChunks = session.dataChunks.slice(-10);
      
      // Process with Deepgram for real-time transcription
      const agent = await this.agentPool.getAvailableAgent('deepgram.audio.transcribe.live');
      if (agent) {
        const partialResult = await agent.execute({
          taskId: uuidv4(),
          taskType: 'deepgram.audio.transcribe.live',
          parameters: {
            audioChunks: recentChunks,
            options: { interim_results: true },
          },
        }, {});

        // Emit partial results
        this.emit('stream:partial', {
          streamId: session.streamId,
          partialResult: partialResult.result,
        });
      }
    } catch (error) {
      this.logger.error('Real-time audio processing failed', error as Error, {
        streamId: session.streamId,
      });
    }
  }

  /**
   * Check if task type can be handled
   */
  private canHandleTask(taskType: string): boolean {
    const supportedTypes = [
      TaskTypes['huggingface.vision.classification'],
      TaskTypes['huggingface.vision.object_detection'],
      TaskTypes['huggingface.vision.segmentation'],
      TaskTypes['huggingface.audio.speech_recognition'],
      TaskTypes['huggingface.audio.text_to_speech'],
      TaskTypes['huggingface.multimodal.visual_qa'],
      TaskTypes['deepgram.audio.transcribe.live'],
      TaskTypes['deepgram.audio.transcribe.file'],
      TaskTypes['deepgram.audio.agent.live'],
      TaskTypes['multimodal.fuse'],
      TaskTypes['artist.generate_image'],
    ];

    return supportedTypes.includes(taskType as any);
  }

  /**
   * Check if task requires sensor fusion
   */
  private requiresSensorFusion(taskType: string): boolean {
    return taskType === TaskTypes['multimodal.fuse'] || 
           taskType.includes('multimodal');
  }

  /**
   * Check if task requires media processing
   */
  private requiresMediaProcessing(taskType: string): boolean {
    return taskType.includes('vision') || 
           taskType.includes('audio') || 
           taskType.includes('image');
  }

  /**
   * Check if result requires post-processing
   */
  private requiresPostProcessing(taskType: string): boolean {
    return this.requiresMediaProcessing(taskType);
  }

  /**
   * Get processing pipeline for task type
   */
  private getProcessingPipeline(taskType: string): string[] {
    const pipelines: Record<string, string[]> = {
      [TaskTypes['huggingface.vision.classification']]: ['preprocess_image', 'classify', 'postprocess'],
      [TaskTypes['deepgram.audio.transcribe.live']]: ['stream_audio', 'transcribe', 'format'],
      [TaskTypes['multimodal.fuse']]: ['sensor_fusion', 'alignment', 'integration'],
    };

    return pipelines[taskType] || ['process'];
  }

  /**
   * Setup streaming handlers
   */
  private setupStreamingHandlers(): void {
    this.streamManager.on('chunk:processed', (data) => {
      this.emit('stream:chunk', data);
    });

    this.streamManager.on('stream:error', (error) => {
      this.logger.error('Stream processing error', error);
    });
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
      this.logger.info('Multi-modal task cancelled', { taskId });
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
      activeStreams: this.activeStreams.size,
      maxConcurrentTasks: this.config.maxConcurrentTasks,
      agentPool: await this.agentPool.getStatus(),
      streamingEnabled: this.config.enableStreaming,
      sensorFusionEnabled: this.config.enableSensorFusion,
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
   * Get supervisor statistics
   */
  getStats() {
    return {
      supervisorId: this.config.supervisorId,
      activeTasks: this.activeTasks.size,
      activeStreams: this.activeStreams.size,
      maxConcurrentTasks: this.config.maxConcurrentTasks,
      initialized: this.isInitialized,
      streamingEnabled: this.config.enableStreaming,
      sensorFusionEnabled: this.config.enableSensorFusion,
      supportedTaskTypes: this.getSupportedTaskTypes(),
    };
  }

  /**
   * Get supported task types
   */
  private getSupportedTaskTypes(): string[] {
    return [
      TaskTypes['huggingface.vision.classification'],
      TaskTypes['huggingface.vision.object_detection'],
      TaskTypes['huggingface.vision.segmentation'],
      TaskTypes['huggingface.audio.speech_recognition'],
      TaskTypes['huggingface.audio.text_to_speech'],
      TaskTypes['huggingface.multimodal.visual_qa'],
      TaskTypes['deepgram.audio.transcribe.live'],
      TaskTypes['deepgram.audio.transcribe.file'],
      TaskTypes['deepgram.audio.agent.live'],
      TaskTypes['multimodal.fuse'],
      TaskTypes['artist.generate_image'],
    ];
  }

  /**
   * Shutdown the supervisor
   */
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down Multi-Modal Supervisor...');

    // Cancel all active tasks
    for (const [taskId, execution] of this.activeTasks) {
      execution.status = 'cancelled';
    }
    this.activeTasks.clear();

    // End all active streams
    for (const [streamId, session] of this.activeStreams) {
      session.status = 'cancelled';
    }
    this.activeStreams.clear();

    // Shutdown components
    await this.agentPool.shutdown();
    await this.streamManager.shutdown();
    await this.sensorFusion.shutdown();
    await this.mediaProcessor.shutdown();

    this.removeAllListeners();
    this.logger.info('Multi-Modal Supervisor shutdown complete');
  }
}

interface TaskExecution {
  taskId: string;
  request: TaskRequest;
  startTime: number;
  status: 'running' | 'completed' | 'cancelled';
  span: any;
}

interface StreamSession {
  streamId: string;
  startTime: number;
  sender: string;
  contentType: string;
  status: 'active' | 'completed' | 'cancelled';
  dataChunks: any[];
}

export default MultiModalSupervisor;