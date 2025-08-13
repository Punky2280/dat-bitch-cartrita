/**
 * @fileoverview MCP Message Router
 * Routes messages between supervisors and maintains agent registry
 */
import { EventEmitter } from 'eventemitter3';
import { v4 as uuidv4 } from 'uuid';
import { trace, SpanKind } from '@opentelemetry/api';
import { MessageTypes, TaskStatus, AgentType, Logger, MCPValidator, TaskTypes } from '../core/index.js';
/**
 * MCP Router manages message routing and agent registry
 */
export class MCPRouter extends EventEmitter {
    logger;
    transport;
    tracer = trace.getTracer('mcp-router');
    agents = new Map();
    supervisors = new Map();
    pendingRequests = new Map();
    constructor(transport) {
        super();
        this.logger = Logger.create('MCPRouter');
        this.transport = transport;
        // Set up message handling
        this.transport.registerHandler('orchestrator', this.handleMessage.bind(this));
        // Initialize default supervisors
        this.initializeDefaultSupervisors();
        this.logger.info('MCP Router initialized');
    }
    /**
     * Register a new agent
     */
    async registerAgent(registration) {
        const span = this.tracer.startSpan('mcp.router.register_agent', {
            attributes: {
                'mcp.agent.id': registration.agentId,
                'mcp.agent.type': registration.type,
            },
        });
        try {
            // Validate registration
            const validation = MCPValidator.safeValidate((data) => MCPValidator.validateMessage(data), registration);
            if (!validation.success) {
                throw new Error(`Invalid agent registration: ${validation.errors.join(', ')}`);
            }
            // Store agent registration
            this.agents.set(registration.agentId, registration);
            // If it's a supervisor, add to supervisor registry
            if (registration.type === AgentType.SUPERVISOR) {
                const supervisorInfo = {
                    id: registration.agentId,
                    name: registration.agentName,
                    type: AgentType.SUPERVISOR,
                    capabilities: registration.capabilities,
                    isHealthy: registration.health.healthy,
                    lastHeartbeat: new Date(),
                    taskCount: 0,
                    maxConcurrentTasks: 10, // Default limit
                };
                this.supervisors.set(registration.agentId, supervisorInfo);
                this.logger.info('Supervisor registered', {
                    supervisorId: registration.agentId,
                    capabilities: registration.capabilities
                });
            }
            // Send registration confirmation
            const confirmMessage = {
                id: uuidv4(),
                traceId: span.spanContext().traceId,
                spanId: span.spanContext().spanId,
                sender: 'orchestrator',
                recipient: registration.agentId,
                messageType: MessageTypes.AGENT_REGISTER,
                payload: { status: 'registered' },
                tags: ['registration'],
                context: {
                    traceId: span.spanContext().traceId,
                    spanId: span.spanContext().spanId,
                    baggage: {},
                    requestId: uuidv4(),
                    timeoutMs: 5000,
                    metadata: {},
                },
                delivery: {
                    guarantee: 'AT_LEAST_ONCE',
                    retryCount: 1,
                    retryDelayMs: 1000,
                    requireAck: false,
                    priority: 5,
                },
                createdAt: new Date(),
                permissions: [],
            };
            await this.transport.sendMessage(confirmMessage);
            this.emit('agent:registered', registration);
            span.setAttributes({ 'mcp.agent.registered': true });
            return registration;
        }
        catch (error) {
            span.recordException(error);
            this.logger.error('Agent registration failed', error, {
                agentId: registration.agentId
            });
            throw error;
        }
        finally {
            span.end();
        }
    }
    /**
     * Route a task to the appropriate supervisor
     */
    async routeTask(taskRequest, supervisorType) {
        const span = this.tracer.startSpan('mcp.router.route_task', {
            kind: SpanKind.CLIENT,
            attributes: {
                'mcp.task.type': taskRequest.taskType,
                'mcp.task.id': taskRequest.taskId,
                'mcp.supervisor.type': supervisorType || 'auto',
            },
        });
        try {
            // Determine target supervisor if not specified
            const targetSupervisor = supervisorType || this.selectSupervisor(taskRequest.taskType);
            // Find available supervisor instance
            const supervisor = this.findAvailableSupervisor(targetSupervisor);
            if (!supervisor) {
                throw new Error(`No available supervisor for type: ${targetSupervisor}`);
            }
            // Create MCP message
            const message = {
                id: uuidv4(),
                correlationId: taskRequest.taskId,
                traceId: span.spanContext().traceId,
                spanId: span.spanContext().spanId,
                sender: 'orchestrator',
                recipient: supervisor.id,
                messageType: MessageTypes.TASK_REQUEST,
                payload: taskRequest,
                tags: ['task', 'routing'],
                context: {
                    traceId: span.spanContext().traceId,
                    spanId: span.spanContext().spanId,
                    baggage: {},
                    requestId: taskRequest.taskId,
                    timeoutMs: 30000,
                    metadata: {
                        'supervisor.type': targetSupervisor,
                        'routing.timestamp': new Date().toISOString(),
                    },
                },
                delivery: {
                    guarantee: 'AT_LEAST_ONCE',
                    retryCount: 3,
                    retryDelayMs: 1000,
                    requireAck: true,
                    priority: taskRequest.priority || 5,
                },
                createdAt: new Date(),
                expiresAt: taskRequest.deadline,
                permissions: [],
            };
            // Send task and wait for response
            const response = await this.sendTaskAndWaitForResponse(message, supervisor);
            span.setAttributes({
                'mcp.task.status': response.status,
                'mcp.supervisor.id': supervisor.id,
            });
            return response;
        }
        catch (error) {
            span.recordException(error);
            this.logger.error('Task routing failed', error, {
                taskId: taskRequest.taskId,
                taskType: taskRequest.taskType
            });
            // Return error response
            return {
                taskId: taskRequest.taskId,
                status: TaskStatus.FAILED,
                errorMessage: error.message,
                errorCode: 'ROUTING_ERROR',
                metrics: {
                    processingTimeMs: 0,
                    queueTimeMs: 0,
                    retryCount: 0,
                    costUsd: 0,
                    tokensUsed: 0,
                    customMetrics: {},
                },
                warnings: [],
            };
        }
        finally {
            span.end();
        }
    }
    /**
     * Handle incoming MCP message
     */
    async handleMessage(message) {
        const span = this.tracer.startSpan('mcp.router.handle_message', {
            kind: SpanKind.SERVER,
            attributes: {
                'mcp.message.type': message.messageType,
                'mcp.message.sender': message.sender,
            },
        });
        try {
            switch (message.messageType) {
                case MessageTypes.TASK_RESPONSE:
                    await this.handleTaskResponse(message);
                    break;
                case MessageTypes.HEARTBEAT:
                    await this.handleHeartbeat(message);
                    break;
                case MessageTypes.AGENT_REGISTER:
                    // Handle agent registration updates
                    break;
                default:
                    this.logger.warn('Unhandled message type', {
                        messageType: message.messageType,
                        messageId: message.id
                    });
            }
            span.setAttributes({ 'mcp.message.handled': true });
        }
        catch (error) {
            span.recordException(error);
            this.logger.error('Message handling failed', error, {
                messageId: message.id,
                messageType: message.messageType,
            });
        }
        finally {
            span.end();
        }
    }
    /**
     * Get agent status
     */
    getAgentStatus(agentId) {
        return this.agents.get(agentId) || null;
    }
    /**
     * Get all registered agents
     */
    getRegisteredAgents() {
        return Array.from(this.agents.values());
    }
    /**
     * Get all supervisors
     */
    getSupervisors() {
        return Array.from(this.supervisors.values());
    }
    /**
     * Get routing statistics
     */
    getStats() {
        return {
            totalAgents: this.agents.size,
            totalSupervisors: this.supervisors.size,
            pendingRequests: this.pendingRequests.size,
            supervisorStats: Array.from(this.supervisors.values()).map(s => ({
                id: s.id,
                name: s.name,
                capabilities: s.capabilities,
                isHealthy: s.isHealthy,
                taskCount: s.taskCount,
                utilization: s.taskCount / s.maxConcurrentTasks,
            })),
        };
    }
    initializeDefaultSupervisors() {
        const defaultSupervisors = [
            {
                id: 'supervisor-intelligence',
                name: 'Intelligence Supervisor',
                type: AgentType.SUPERVISOR,
                capabilities: [
                    TaskTypes['langchain.agent.execute'],
                    TaskTypes['huggingface.text.generation'],
                    TaskTypes['research.web.search'],
                    TaskTypes['writer.compose'],
                    TaskTypes['codewriter.generate'],
                ],
                isHealthy: true,
                lastHeartbeat: new Date(),
                taskCount: 0,
                maxConcurrentTasks: 10,
            },
            {
                id: 'supervisor-multimodal',
                name: 'Multi-Modal Supervisor',
                type: AgentType.SUPERVISOR,
                capabilities: [
                    TaskTypes['huggingface.vision.classification'],
                    TaskTypes['deepgram.audio.transcribe.live'],
                    TaskTypes['multimodal.fuse'],
                    TaskTypes['artist.generate_image'],
                ],
                isHealthy: true,
                lastHeartbeat: new Date(),
                taskCount: 0,
                maxConcurrentTasks: 5,
            },
            {
                id: 'supervisor-system',
                name: 'System Supervisor',
                type: AgentType.SUPERVISOR,
                capabilities: [
                    TaskTypes['system.health_check'],
                    TaskTypes['lifeos.calendar.sync'],
                    TaskTypes['security.audit'],
                    TaskTypes['memory.knowledge_graph.query'],
                ],
                isHealthy: true,
                lastHeartbeat: new Date(),
                taskCount: 0,
                maxConcurrentTasks: 15,
            },
        ];
        for (const supervisor of defaultSupervisors) {
            this.supervisors.set(supervisor.id, supervisor);
        }
        this.logger.info('Default supervisors initialized', {
            count: defaultSupervisors.length
        });
    }
    selectSupervisor(taskType) {
        // Use MCPValidator to determine supervisor
        return MCPValidator.getSupervisorForTask(taskType);
    }
    findAvailableSupervisor(supervisorType) {
        // Find supervisors that can handle this type
        const candidates = Array.from(this.supervisors.values()).filter(s => s.id.includes(supervisorType) &&
            s.isHealthy &&
            s.taskCount < s.maxConcurrentTasks);
        if (candidates.length === 0) {
            return null;
        }
        // Select supervisor with lowest utilization
        return candidates.sort((a, b) => {
            const utilizationA = a.taskCount / a.maxConcurrentTasks;
            const utilizationB = b.taskCount / b.maxConcurrentTasks;
            return utilizationA - utilizationB;
        })[0];
    }
    async sendTaskAndWaitForResponse(message, supervisor) {
        const taskId = message.correlationId;
        const timeoutMs = message.context.timeoutMs || 30000;
        return new Promise((resolve, reject) => {
            // Set up timeout
            const timeout = setTimeout(() => {
                this.pendingRequests.delete(taskId);
                reject(new Error(`Task timeout after ${timeoutMs}ms`));
            }, timeoutMs);
            // Store pending request
            this.pendingRequests.set(taskId, {
                resolve: (response) => {
                    clearTimeout(timeout);
                    supervisor.taskCount = Math.max(0, supervisor.taskCount - 1);
                    resolve(response);
                },
                reject: (error) => {
                    clearTimeout(timeout);
                    supervisor.taskCount = Math.max(0, supervisor.taskCount - 1);
                    reject(error);
                },
                timeout,
            });
            // Increment task count
            supervisor.taskCount++;
            // Send message
            this.transport.sendMessage(message).catch(reject);
        });
    }
    async handleTaskResponse(message) {
        const taskId = message.correlationId;
        if (!taskId) {
            this.logger.warn('Task response without correlation ID', { messageId: message.id });
            return;
        }
        const pending = this.pendingRequests.get(taskId);
        if (!pending) {
            this.logger.warn('Received response for unknown task', { taskId });
            return;
        }
        this.pendingRequests.delete(taskId);
        try {
            const response = message.payload;
            pending.resolve(response);
        }
        catch (error) {
            pending.reject(new Error(`Invalid task response: ${error}`));
        }
    }
    async handleHeartbeat(message) {
        const senderId = message.sender;
        const supervisor = this.supervisors.get(senderId);
        if (supervisor) {
            supervisor.lastHeartbeat = new Date();
            supervisor.isHealthy = true;
        }
        // Send heartbeat response
        const response = {
            id: uuidv4(),
            correlationId: message.id,
            traceId: message.traceId,
            spanId: message.spanId,
            sender: 'orchestrator',
            recipient: senderId,
            messageType: MessageTypes.HEARTBEAT,
            payload: { timestamp: Date.now(), status: 'pong' },
            tags: ['heartbeat'],
            context: message.context,
            delivery: {
                guarantee: 'AT_MOST_ONCE',
                retryCount: 0,
                retryDelayMs: 0,
                requireAck: false,
                priority: 1,
            },
            createdAt: new Date(),
            permissions: [],
        };
        await this.transport.sendMessage(response);
    }
}
