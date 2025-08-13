/**
 * @fileoverview MCP Bridge
 * Provides backward compatibility between legacy v2 API and MCP v3
 */
import { v4 as uuidv4 } from 'uuid';
import { trace, SpanKind } from '@opentelemetry/api';
import { TaskStatus, MessageTypes, TaskTypes, Logger } from '../core/index.js';
/**
 * Legacy API Bridge for backwards compatibility
 * Maps v2 endpoints to MCP v3 task execution
 */
export class MCPBridge {
    logger;
    transport;
    tracer = trace.getTracer('mcp-bridge');
    // Mapping of legacy endpoints to MCP task types
    endpointMappings = new Map();
    constructor(transport) {
        this.logger = Logger.create('MCPBridge');
        this.transport = transport;
        this.initializeEndpointMappings();
        this.logger.info('MCP Bridge initialized');
    }
    /**
     * Handle legacy HTTP request
     */
    async handleLegacyRequest(request, reply) {
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
        }
        catch (error) {
            span.recordException(error);
            this.logger.error('Legacy request handling failed', error, {
                method: request.method,
                url: request.url,
            });
            return reply.status(500).send({
                error: 'Internal server error',
                message: error.message,
                legacy: true,
            });
        }
        finally {
            span.end();
        }
    }
    /**
     * Handle legacy WebSocket events
     */
    async handleLegacySocketEvent(eventName, data) {
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
            const taskRequest = {
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
        }
        catch (error) {
            span.recordException(error);
            this.logger.error('Legacy socket event handling failed', error, {
                eventName,
            });
            throw error;
        }
        finally {
            span.end();
        }
    }
    /**
     * Handle legacy authentication
     */
    async handleAuthRequest(request, reply) {
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
        }
        catch (error) {
            span.recordException(error);
            this.logger.error('Auth request failed', error);
            return reply.status(500).send({
                error: 'Authentication failed',
                message: error.message,
            });
        }
        finally {
            span.end();
        }
    }
    initializeEndpointMappings() {
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
    normalizeEndpoint(url) {
        // Remove query parameters and normalize path
        const path = url.split('?')[0];
        return path.replace(/\/+$/, '') || '/';
    }
    async convertToMCPTask(request, mapping) {
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
    async executeMCPTask(taskRequest) {
        // This would route through the MCP router in practice
        // For now, simulate task execution
        const message = {
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
        return this.transport.sendTaskRequest(taskRequest, 'supervisor', 'bridge', 30000);
    }
    async convertToLegacyResponse(taskResponse, endpoint) {
        let statusCode = 200;
        let data = taskResponse.result;
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
    getSocketEventMapping(eventName) {
        const mappings = {
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
    convertSocketResponse(taskResponse, eventName) {
        if (taskResponse.status === TaskStatus.COMPLETED) {
            return {
                success: true,
                data: taskResponse.result,
                event: eventName,
            };
        }
        else {
            return {
                success: false,
                error: taskResponse.errorMessage,
                code: taskResponse.errorCode,
                event: eventName,
            };
        }
    }
    async handleUnmappedEndpoint(request, reply) {
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
    async authenticateUser(email, password) {
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
    generateMockToken(user) {
        // Mock token generation - replace with real JWT
        return `mock_token_${user.id}_${Date.now()}`;
    }
}
