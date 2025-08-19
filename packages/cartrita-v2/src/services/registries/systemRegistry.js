/**
 * System Registry - System-level tool registration
 * Registers basic system tools for agents
 */

import { logger } from '../../core/logger.js';

export function registerSystemTools(registry) {
    try {
        logger.info('📋 Registering system tools...');

        // Basic system tools
        registry.registerTool('echo', {
            name: 'echo',
            description: 'Echo back a message',
            parameters: {
                type: 'object',
                properties: {
                    message: { type: 'string' }
                },
                required: ['message']
            },
            execute: async (params) => {
                return { result: params.message };
            }
        }, 'system');

        registry.registerTool('timestamp', {
            name: 'timestamp',
            description: 'Get current timestamp',
            parameters: { type: 'object', properties: {} },
            execute: async () => {
                return { result: new Date().toISOString() };
            }
        }, 'system');

        registry.registerTool('status_check', {
            name: 'status_check',
            description: 'Check system status',
            parameters: { type: 'object', properties: {} },
            execute: async () => {
                return {
                    result: {
                        status: 'operational',
                        timestamp: new Date().toISOString(),
                        uptime: process.uptime()
                    }
                };
            }
        }, 'system');

        logger.info('✅ System tools registered successfully');
        return true;
    } catch (error) {
        logger.error('❌ Failed to register system tools:', error);
        return false;
    }
}

export default registerSystemTools;