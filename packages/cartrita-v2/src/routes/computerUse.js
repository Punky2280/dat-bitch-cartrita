/**
 * Cartrita V2 - Computer Use Agent API Routes
 * RESTful API for managing Computer Use Agents with hierarchical supervision
 */

import ComputerUseAgentBridge from '../services/ComputerUseAgentBridge.js';

async function computerUseRoutes(fastify, options) {
    const { database, logger, tracing } = fastify;

    // Initialize Computer Use Agent Bridge
    const agentBridge = new ComputerUseAgentBridge(logger, tracing);
    
    // Hook to initialize bridge on server start
    fastify.ready(async () => {
        try {
            await agentBridge.initialize();
            logger.info('Computer Use Agent Bridge ready');
        } catch (error) {
            logger.error('Failed to initialize Computer Use Agent Bridge', { error: error.message });
        }
    });

    // Hook to cleanup bridge on server close
    fastify.addHook('onClose', async () => {
        await agentBridge.cleanup();
    });

    // Create a new Computer Use Agent
    fastify.post('/agents', {
        schema: {
            body: {
                type: 'object',
                required: ['agentName'],
                properties: {
                    agentName: { type: 'string', minLength: 1, maxLength: 50 },
                    permissionLevel: { 
                        type: 'string',
                        enum: ['RESTRICTED', 'SUPERVISED', 'AUTONOMOUS', 'ADMIN'],
                        default: 'SUPERVISED'
                    },
                    displayWidth: { type: 'integer', minimum: 800, maximum: 4096, default: 1024 },
                    displayHeight: { type: 'integer', minimum: 600, maximum: 2160, default: 768 },
                    environment: { 
                        type: 'string',
                        enum: ['mac', 'windows', 'ubuntu', 'browser'],
                        default: 'ubuntu'
                    },
                    description: { type: 'string', maxLength: 500 }
                }
            }
        }
    }, async (request, reply) => {
        const { agentName, permissionLevel, displayWidth, displayHeight, environment, description } = request.body;

        try {
            const result = await agentBridge.createAgent(agentName, permissionLevel, {
                displayWidth,
                displayHeight,
                environment,
                description,
                createdBy: request.user?.id || 'anonymous',
                ipAddress: request.ip
            });

            // Log agent creation to database
            try {
                await database.query(`
                    INSERT INTO computer_use_agents (agent_id, agent_name, permission_level, config, created_by, created_at)
                    VALUES ($1, $2, $3, $4, $5, NOW())
                `, [
                    result.agentId,
                    agentName,
                    permissionLevel,
                    JSON.stringify({ displayWidth, displayHeight, environment, description }),
                    request.user?.id || 'anonymous'
                ]);
            } catch (dbError) {
                logger.warn('Failed to log agent creation to database', { error: dbError.message });
            }

            logger.info('Computer Use Agent created via API', {
                agentId: result.agentId,
                agentName,
                permissionLevel,
                createdBy: request.user?.id
            });

            return {
                success: true,
                data: result
            };

        } catch (error) {
            logger.error('Failed to create Computer Use Agent', { error: error.message });
            reply.code(500);
            return {
                success: false,
                error: error.message
            };
        }
    });

    // Execute a computer task
    fastify.post('/agents/:agentId/execute', {
        schema: {
            params: {
                type: 'object',
                properties: {
                    agentId: { type: 'string' }
                }
            },
            body: {
                type: 'object',
                required: ['task'],
                properties: {
                    task: { type: 'string', minLength: 1, maxLength: 2000 },
                    justification: { type: 'string', maxLength: 500 },
                    maxIterations: { type: 'integer', minimum: 1, maximum: 50, default: 10 },
                    safetyLevel: {
                        type: 'string',
                        enum: ['strict', 'moderate', 'permissive'],
                        default: 'moderate'
                    },
                    timeout: { type: 'integer', minimum: 30, maximum: 3600, default: 300 }
                }
            }
        }
    }, async (request, reply) => {
        const { agentId } = request.params;
        const { task, justification, maxIterations, safetyLevel, timeout } = request.body;

        try {
            // First request computer access
            const accessResult = await agentBridge.requestComputerAccess(
                agentId,
                task,
                justification || 'User requested task execution'
            );

            if (accessResult.accessRequest.status !== 'approved') {
                reply.code(403);
                return {
                    success: false,
                    error: 'Computer access not approved',
                    accessRequest: accessResult.accessRequest
                };
            }

            // Execute the task
            const executionResult = await agentBridge.executeComputerTask(agentId, task, {
                maxIterations,
                safetyLevel,
                timeout,
                justification,
                requestedBy: request.user?.id || 'anonymous'
            });

            // Log execution to database
            try {
                await database.query(`
                    INSERT INTO computer_use_executions (
                        execution_id, agent_id, task, justification, 
                        max_iterations, safety_level, status, result, 
                        requested_by, created_at
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
                `, [
                    executionResult.executionId,
                    agentId,
                    task,
                    justification,
                    maxIterations,
                    safetyLevel,
                    'completed',
                    JSON.stringify(executionResult.result),
                    request.user?.id || 'anonymous'
                ]);
            } catch (dbError) {
                logger.warn('Failed to log execution to database', { error: dbError.message });
            }

            logger.info('Computer task executed via API', {
                agentId,
                executionId: executionResult.executionId,
                taskLength: task.length,
                requestedBy: request.user?.id
            });

            return {
                success: true,
                data: executionResult
            };

        } catch (error) {
            logger.error('Computer task execution failed', {
                agentId,
                error: error.message,
                task: task.substring(0, 100) + '...'
            });

            // Log failed execution to database
            try {
                await database.query(`
                    INSERT INTO computer_use_executions (
                        execution_id, agent_id, task, justification,
                        max_iterations, safety_level, status, error,
                        requested_by, created_at
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
                `, [
                    `failed_${Date.now()}`,
                    agentId,
                    task,
                    justification,
                    maxIterations,
                    safetyLevel,
                    'failed',
                    error.message,
                    request.user?.id || 'anonymous'
                ]);
            } catch (dbError) {
                logger.warn('Failed to log failed execution to database', { error: dbError.message });
            }

            reply.code(500);
            return {
                success: false,
                error: error.message
            };
        }
    });

    // Get agent status
    fastify.get('/agents/:agentId/status', async (request, reply) => {
        const { agentId } = request.params;

        try {
            const status = agentBridge.getAgentStatus(agentId);
            
            if (!status) {
                reply.code(404);
                return {
                    success: false,
                    error: 'Agent not found'
                };
            }

            return {
                success: true,
                data: status
            };

        } catch (error) {
            logger.error('Failed to get agent status', { agentId, error: error.message });
            reply.code(500);
            return {
                success: false,
                error: error.message
            };
        }
    });

    // List all agents
    fastify.get('/agents', async (request, reply) => {
        try {
            const agents = agentBridge.listAgents();

            return {
                success: true,
                data: {
                    agents,
                    count: agents.length
                }
            };

        } catch (error) {
            logger.error('Failed to list agents', { error: error.message });
            reply.code(500);
            return {
                success: false,
                error: error.message
            };
        }
    });

    // Get system status
    fastify.get('/system/status', async (request, reply) => {
        try {
            const status = agentBridge.getSystemStatus();

            return {
                success: true,
                data: status
            };

        } catch (error) {
            logger.error('Failed to get system status', { error: error.message });
            reply.code(500);
            return {
                success: false,
                error: error.message
            };
        }
    });

    // Get agent execution history
    fastify.get('/agents/:agentId/executions', {
        schema: {
            params: {
                type: 'object',
                properties: {
                    agentId: { type: 'string' }
                }
            },
            querystring: {
                type: 'object',
                properties: {
                    limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
                    offset: { type: 'integer', minimum: 0, default: 0 },
                    status: { type: 'string', enum: ['completed', 'failed', 'pending'] }
                }
            }
        }
    }, async (request, reply) => {
        const { agentId } = request.params;
        const { limit = 20, offset = 0, status } = request.query;

        try {
            let query = `
                SELECT execution_id, task, justification, max_iterations, 
                       safety_level, status, error, result,
                       requested_by, created_at, updated_at
                FROM computer_use_executions 
                WHERE agent_id = $1
            `;
            
            const params = [agentId];
            
            if (status) {
                query += ' AND status = $2';
                params.push(status);
                query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
                params.push(limit, offset);
            } else {
                query += ` ORDER BY created_at DESC LIMIT $2 OFFSET $3`;
                params.push(limit, offset);
            }

            const result = await database.query(query, params);

            return {
                success: true,
                data: {
                    executions: result.rows,
                    count: result.rows.length,
                    limit,
                    offset
                }
            };

        } catch (error) {
            logger.error('Failed to get execution history', { agentId, error: error.message });
            reply.code(500);
            return {
                success: false,
                error: error.message
            };
        }
    });

    // WebSocket endpoint for real-time task monitoring
    fastify.get('/agents/:agentId/monitor', { websocket: true }, async (connection, request) => {
        const { agentId } = request.params;
        
        logger.info('WebSocket connection established for agent monitoring', { agentId });

        // Send initial agent status
        try {
            const status = agentBridge.getAgentStatus(agentId);
            connection.socket.send(JSON.stringify({
                type: 'agent_status',
                data: status,
                timestamp: new Date().toISOString()
            }));
        } catch (error) {
            connection.socket.send(JSON.stringify({
                type: 'error',
                error: error.message,
                timestamp: new Date().toISOString()
            }));
        }

        // Listen for agent events
        const onTaskProgress = (data) => {
            if (data.agentId === agentId) {
                connection.socket.send(JSON.stringify({
                    type: 'task_progress',
                    data,
                    timestamp: new Date().toISOString()
                }));
            }
        };

        const onTaskCompleted = (execution) => {
            if (execution.agentId === agentId) {
                connection.socket.send(JSON.stringify({
                    type: 'task_completed',
                    data: execution,
                    timestamp: new Date().toISOString()
                }));
            }
        };

        const onTaskFailed = (execution) => {
            if (execution.agentId === agentId) {
                connection.socket.send(JSON.stringify({
                    type: 'task_failed',
                    data: execution,
                    timestamp: new Date().toISOString()
                }));
            }
        };

        // Register event listeners
        agentBridge.on('taskProgress', onTaskProgress);
        agentBridge.on('taskCompleted', onTaskCompleted);
        agentBridge.on('taskFailed', onTaskFailed);

        // Cleanup on disconnect
        connection.socket.on('close', () => {
            agentBridge.removeListener('taskProgress', onTaskProgress);
            agentBridge.removeListener('taskCompleted', onTaskCompleted);
            agentBridge.removeListener('taskFailed', onTaskFailed);
            logger.info('WebSocket connection closed for agent monitoring', { agentId });
        });

        connection.socket.on('error', (error) => {
            logger.error('WebSocket error in agent monitoring', { agentId, error: error.message });
        });
    });

    // Health check endpoint
    fastify.get('/health', async (request, reply) => {
        try {
            const systemStatus = agentBridge.getSystemStatus();
            
            return {
                success: true,
                data: {
                    service: 'computer_use_agents',
                    status: systemStatus.bridge.initialized ? 'healthy' : 'initializing',
                    version: '2.0.0',
                    capabilities: systemStatus.capabilities,
                    agents: systemStatus.agents.length,
                    timestamp: new Date().toISOString()
                }
            };

        } catch (error) {
            reply.code(503);
            return {
                success: false,
                error: 'Service unavailable',
                details: error.message
            };
        }
    });

    logger.info('Computer Use Agent routes registered');
}

export default computerUseRoutes;