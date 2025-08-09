/**
 * @fileoverview MCP Bridge
 * Provides backward compatibility between legacy v2 API and MCP v3
 */

import { v4 as uuidv4 } from 'uuid';
import { trace, SpanKind } from '@opentelemetry/api';
import { 
  MCPInProcessTransport, 
  MCPMessage, 
  TaskRequest, 
  TaskResponse,
  TaskStatus,
  MessageTypes,
  TaskTypes,
  Logger
} from '@cartrita/mcp-core';

export interface LegacyRequest {
  method: string;
  url: string;
  params?: any;
  query?: any;
  body?: any;
  headers?: any;
  user?: any;
}

export interface LegacyResponse {
  statusCode: number;
  headers?: any;
  data: any;
}

/**
 * Legacy API Bridge for backwards compatibility
 * Maps v2 endpoints to MCP v3 task execution
 */
export class MCPBridge {
  private readonly logger: Logger;
  private readonly transport: MCPInProcessTransport;
  private readonly tracer = trace.getTracer('mcp-bridge');
  
  // Mapping of legacy endpoints to MCP task types
  private readonly endpointMappings = new Map<string, {
    taskType: string;
    parameterMapper: (legacyData: any) => any;
  }>();

  constructor(transport: MCPInProcessTransport) {
    this.logger = Logger.create('MCPBridge');
    this.transport = transport;
    
    this.initializeEndpointMappings();
    this.logger.info('MCP Bridge initialized');
  }

  /**
   * Handle legacy HTTP request
   */
  async handleLegacyRequest(request: LegacyRequest, reply: any): Promise<any> {
    const span = this.tracer.startSpan('mcp.bridge.legacy_request', {
      kind: SpanKind.SERVER,
      attributes: {
        'http.method': request.method,
        'http.url': request.url,
        'legacy.endpoint': request.url,
      },
    });

    try {
      // Extract endpoint path
      const endpoint = this.normalizeEndpoint(request.url);
      const mapping = this.endpointMappings.get(endpoint);

      if (!mapping) {
        return this.handleUnmappedEndpoint(request, reply);
      }

      // Convert legacy request to MCP task
      const taskRequest = await this.convertToMCPTask(request, mapping);
      
      // Execute task via MCP
      const taskResponse = await this.executeMCPTask(taskRequest);
      
      // Convert MCP response back to legacy format
      const legacyResponse = await this.convertToLegacyResponse(taskResponse, endpoint);

      span.setAttributes({
        'mcp.task.type': mapping.taskType,
        'mcp.task.status': taskResponse.status,
        'legacy.status_code': legacyResponse.statusCode,
      });

      // Add deprecation headers
      reply.header('X-API-Version', 'v2-legacy');
      reply.header('X-Deprecation-Warning', 'This API version is deprecated. Please migrate to v3');
      reply.header('X-Migration-Guide', 'https://docs.cartrita.com/api/migration-v2-to-v3');

      return reply.status(legacyResponse.statusCode).send(legacyResponse.data);
    } catch (error) {
      span.recordException(error as Error);
      this.logger.error('Legacy request handling failed', error as Error, {
        method: request.method,
        url: request.url,
      });

      return reply.status(500).send({
        error: 'Internal server error',
        message: (error as Error).message,
        legacy: true,
      });
    } finally {
      span.end();
    }
  }

  /**
   * Handle legacy WebSocket events
   */
  async handleLegacySocketEvent(eventName: string, data: any): Promise<any> {
    const span = this.tracer.startSpan('mcp.bridge.legacy_socket', {
      attributes: {
        'socket.event': eventName,
      },
    });

    try {
      const mapping = this.getSocketEventMapping(eventName);
      if (!mapping) {
        throw new Error(`Unsupported socket event: ${eventName}`);
      }

      // Convert to MCP task
      const taskRequest: TaskRequest = {
        taskId: uuidv4(),
        taskType: mapping.taskType,
        parameters: mapping.parameterMapper(data),
        metadata: {
          'legacy.event': eventName,
          'legacy.source': 'websocket',
        },
        priority: 5,
      };

      // Execute via MCP
      const response = await this.executeMCPTask(taskRequest);
      
      span.setAttributes({
        'mcp.task.type': mapping.taskType,
        'mcp.task.status': response.status,
      });

      return this.convertSocketResponse(response, eventName);
    } catch (error) {
      span.recordException(error as Error);
      this.logger.error('Legacy socket event handling failed', error as Error, {
        eventName,
      });
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Handle legacy authentication
   */
  async handleAuthRequest(request: any, reply: any): Promise<any> {
    const span = this.tracer.startSpan('mcp.bridge.auth_request', {
      attributes: {
        'auth.email': request.body?.email,
      },
    });

    try {
      // This would typically interact with the database directly
      // For now, we'll simulate authentication
      
      const { email, password } = request.body;
      
      if (!email || !password) {
        return reply.status(400).send({
          error: 'Missing email or password',
        });
      }

      // Mock user lookup - in practice this would query the database
      const user = await this.authenticateUser(email, password);
      
      if (!user) {
        return reply.status(401).send({
          error: 'Invalid credentials',
        });
      }

      // Generate token (this would use the security manager)
      const token = this.generateMockToken(user);
      
      span.setAttributes({
        'auth.success': true,
        'user.id': user.id,
      });

      return {
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
        },
      };
    } catch (error) {
      span.recordException(error as Error);
      this.logger.error('Auth request failed', error as Error);
      return reply.status(500).send({
        error: 'Authentication failed',
        message: (error as Error).message,
      });
    } finally {
      span.end();
    }
  }

  private initializeEndpointMappings(): void {
    // Chat endpoints
    this.endpointMappings.set('/api/chat', {
      taskType: TaskTypes['langchain.chat.execute'],
      parameterMapper: (data) => ({
        message: data.message || data.text,
        history: data.history || [],
        model: data.model || 'gpt-3.5-turbo',
      }),
    });

    // Voice endpoints
    this.endpointMappings.set('/api/voice-to-text', {
      taskType: TaskTypes['deepgram.audio.transcribe.file'],
      parameterMapper: (data) => ({
        audioData: data.audio || data.file,
        options: {
          language: data.language || 'en',
          model: data.model || 'nova-2',
        },
      }),
    });

    this.endpointMappings.set('/api/voice-chat', {
      taskType: TaskTypes['deepgram.audio.agent.live'],
      parameterMapper: (data) => ({
        audioStream: data.stream,
        config: {
          language: data.language || 'en',
          sampleRate: data.sampleRate || 16000,
        },
      }),
    });

    // Vision endpoints  
    this.endpointMappings.set('/api/vision', {
      taskType: TaskTypes['huggingface.vision.classification'],
      parameterMapper: (data) => ({
        imageUrl: data.image || data.imageUrl,
        options: {
          model: data.model || 'google/vit-base-patch16-224',
        },
      }),
    });

    // System endpoints
    this.endpointMappings.set('/api/health', {
      taskType: TaskTypes['system.health_check'],
      parameterMapper: () => ({}),
    });

    // Knowledge endpoints
    this.endpointMappings.set('/api/knowledge', {
      taskType: TaskTypes['memory.knowledge_graph.query'],
      parameterMapper: (data) => ({
        query: data.query || data.search,
        options: {
          limit: data.limit || 10,
          threshold: data.threshold || 0.7,
        },
      }),
    });

    this.logger.info('Endpoint mappings initialized', { 
      count: this.endpointMappings.size 
    });
  }

  private normalizeEndpoint(url: string): string {
    // Remove query parameters and normalize path
    const path = url.split('?')[0];
    return path.replace(/\/+$/, '') || '/';
  }

  private async convertToMCPTask(
    request: LegacyRequest, 
    mapping: { taskType: string; parameterMapper: (data: any) => any }
  ): Promise<TaskRequest> {
    const parameters = mapping.parameterMapper(request.body || request.query);
    
    return {
      taskId: uuidv4(),
      taskType: mapping.taskType,
      parameters,
      metadata: {
        'legacy.method': request.method,
        'legacy.url': request.url,
        'legacy.user_agent': request.headers?.['user-agent'],
        'user.id': request.user?.id,
      },
      priority: 5,
    };
  }

  private async executeMCPTask(taskRequest: TaskRequest): Promise<TaskResponse> {
    // This would route through the MCP router in practice
    // For now, simulate task execution
    
    const message: MCPMessage = {
      id: uuidv4(),
      correlationId: taskRequest.taskId,
      traceId: uuidv4(),
      spanId: uuidv4(),
      sender: 'bridge',
      recipient: 'supervisor', // Would determine appropriate supervisor
      messageType: MessageTypes.TASK_REQUEST,
      payload: taskRequest,
      tags: ['legacy', 'bridge'],
      context: {
        traceId: uuidv4(),
        spanId: uuidv4(),
        baggage: {},
        requestId: taskRequest.taskId,
        timeoutMs: 30000,
        metadata: {},
      },
      delivery: {
        guarantee: 'AT_LEAST_ONCE',
        retryCount: 3,
        retryDelayMs: 1000,
        requireAck: true,
        priority: taskRequest.priority || 5,
      },
      createdAt: new Date(),
      permissions: [],
    };

    // Send via transport and wait for response
    return this.transport.sendTaskRequest(
      taskRequest,
      'supervisor',
      'bridge',
      30000
    );
  }

  private async convertToLegacyResponse(
    taskResponse: TaskResponse, 
    endpoint: string
  ): Promise<LegacyResponse> {
    let statusCode = 200;
    let data: any = taskResponse.result;

    // Map task status to HTTP status
    switch (taskResponse.status) {
      case TaskStatus.COMPLETED:
        statusCode = 200;
        break;
      case TaskStatus.FAILED:
        statusCode = 500;
        data = {
          error: taskResponse.errorMessage,
          code: taskResponse.errorCode,
        };
        break;
      case TaskStatus.TIMEOUT:
        statusCode = 408;
        data = {
          error: 'Request timeout',
          message: taskResponse.errorMessage,
        };
        break;
      case TaskStatus.CANCELLED:
        statusCode = 499;
        data = {
          error: 'Request cancelled',
          message: taskResponse.errorMessage,
        };
        break;
      default:
        statusCode = 500;
        data = {
          error: 'Unknown task status',
          status: taskResponse.status,
        };
    }

    // Add legacy-specific formatting
    if (statusCode === 200 && data) {
      data = {
        success: true,
        data,
        meta: {
          taskId: taskResponse.taskId,
          processingTime: taskResponse.metrics.processingTimeMs,
          tokensUsed: taskResponse.metrics.tokensUsed,
          cost: taskResponse.metrics.costUsd,
        },
      };
    }

    return {
      statusCode,
      data,
      headers: {
        'X-Legacy-Bridge': 'true',
        'X-Task-ID': taskResponse.taskId,
      },
    };
  }

  private getSocketEventMapping(eventName: string): { taskType: string; parameterMapper: (data: any) => any } | null {
    const mappings: Record<string, { taskType: string; parameterMapper: (data: any) => any }> = {
      chat: {
        taskType: TaskTypes['langchain.chat.execute'],
        parameterMapper: (data) => ({
          message: data.message,
          history: data.history || [],
        }),
      },
      voice_start: {
        taskType: TaskTypes['deepgram.audio.agent.live'],
        parameterMapper: (data) => ({
          action: 'start',
          config: data.config || {},
        }),
      },
      voice_data: {
        taskType: TaskTypes['deepgram.audio.agent.live'],
        parameterMapper: (data) => ({
          action: 'data',
          audioData: data.audio,
        }),
      },
    };

    return mappings[eventName] || null;
  }

  private convertSocketResponse(taskResponse: TaskResponse, eventName: string): any {
    if (taskResponse.status === TaskStatus.COMPLETED) {
      return {
        success: true,
        data: taskResponse.result,
        event: eventName,
      };
    } else {
      return {
        success: false,
        error: taskResponse.errorMessage,
        code: taskResponse.errorCode,
        event: eventName,
      };
    }
  }

  private async handleUnmappedEndpoint(request: LegacyRequest, reply: any): Promise<any> {
    this.logger.warn('Unmapped legacy endpoint', { 
      method: request.method, 
      url: request.url 
    });

    return reply.status(404).send({
      error: 'Endpoint not found',
      message: `Legacy endpoint ${request.method} ${request.url} is not supported`,
      migrationGuide: 'https://docs.cartrita.com/api/migration-v2-to-v3',
    });
  }

  private async authenticateUser(email: string, password: string): Promise<any> {
    // Mock authentication - replace with real database query
    if (email === 'user@example.com' && password === 'password') {
      return {
        id: '123',
        email: 'user@example.com',
        name: 'Test User',
        role: 'user',
      };
    }
    return null;
  }

  private generateMockToken(user: any): string {
    // Mock token generation - replace with real JWT
    return `mock_token_${user.id}_${Date.now()}`;
  }
}