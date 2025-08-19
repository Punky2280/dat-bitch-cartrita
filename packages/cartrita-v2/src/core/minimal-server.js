/**
 * Cartrita V2 - Minimal Working Server
 * Quick working version to get the frontend connected
 */

import Fastify from 'fastify';
import { logger } from './logger.js';

// Basic Fastify plugins
import fastifyCors from '@fastify/cors';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';

export class CartritaV2MinimalServer {
    constructor() {
        this.fastify = null;
        this.isInitialized = false;
        this.startupTime = Date.now();
    }

    async createServer() {
        logger.info('🚀 Creating Cartrita V2 Minimal Server...');

        this.fastify = Fastify({
            logger: {
                level: process.env.LOG_LEVEL || 'info'
            },
            trustProxy: true
        });

        await this.setupBasicMiddleware();
        await this.setupBasicRoutes();
        await this.setupDocumentation();

        this.isInitialized = true;
        logger.info('✅ Cartrita V2 Minimal Server created successfully');
        
        return this.fastify;
    }

    async setupBasicMiddleware() {
        // Basic CORS
        await this.fastify.register(fastifyCors, {
            origin: true,
            credentials: true
        });
    }

    async setupBasicRoutes() {
        // Health endpoints
        this.fastify.get('/health', async (request, reply) => {
            return {
                status: 'healthy',
                timestamp: new Date().toISOString(),
                uptime: Date.now() - this.startupTime,
                version: '2.0.0-minimal'
            };
        });

        this.fastify.get('/health/detailed', async (request, reply) => {
            return {
                status: 'healthy',
                timestamp: new Date().toISOString(),
                uptime: Date.now() - this.startupTime,
                version: '2.0.0-minimal',
                services: {
                    database: { status: 'mock' },
                    rag: { status: 'mock' },
                    mcp: { status: 'mock' }
                }
            };
        });

        // API V2 root
        this.fastify.get('/api/v2', async (request, reply) => {
            return {
                success: true,
                data: {
                    name: 'Cartrita V2 Minimal',
                    version: '2.0.0-minimal',
                    status: 'operational',
                    cartritaGreeting: "Hey! I'm Cartrita, running in minimal mode but still ready to help! 🚀"
                }
            };
        });

        // Mock endpoints that the frontend expects
        this.fastify.get('/api/settings', async (request, reply) => {
            return {
                success: true,
                data: {
                    theme: 'dark',
                    notifications: true,
                    language: 'en'
                }
            };
        });

        this.fastify.get('/api/health/system', async (request, reply) => {
            return {
                success: true,
                data: {
                    status: 'healthy',
                    uptime: Date.now() - this.startupTime,
                    memory: process.memoryUsage()
                }
            };
        });

        this.fastify.get('/api/system/health', async (request, reply) => {
            return {
                success: true,
                data: {
                    status: 'healthy',
                    services: ['minimal_server']
                }
            };
        });

        this.fastify.get('/api/health/agents', async (request, reply) => {
            return {
                success: true,
                data: {
                    agents: [
                        {
                            id: 'cartrita_minimal',
                            name: 'Cartrita Minimal',
                            status: 'active'
                        }
                    ]
                }
            };
        });

        this.fastify.get('/api/workflows', async (request, reply) => {
            return {
                success: true,
                data: {
                    workflows: []
                }
            };
        });

        // Chat endpoint
        this.fastify.post('/api/chat', async (request, reply) => {
            const { message } = request.body || {};
            
            return {
                success: true,
                data: {
                    response: `Hey! I got your message: "${message}". I'm running in minimal mode but still here to help! 💪`,
                    timestamp: new Date().toISOString()
                }
            };
        });

        // Enhanced chat endpoint
        this.fastify.post('/api/v2/chat/enhanced/chat', async (request, reply) => {
            const { message } = request.body || {};
            
            return {
                success: true,
                data: {
                    response: `Alright! "${message}" - I'm processing that with my Miami street smarts! Running minimal mode but my personality is at full strength! 🔥`,
                    agent_used: 'cartrita_minimal',
                    processing_time: 42,
                    cartrita_personality_score: 0.95
                }
            };
        });

        this.fastify.get('/api/v2/chat/enhanced/status', async (request, reply) => {
            return {
                success: true,
                data: {
                    status: 'operational',
                    version: '2.0.0-minimal',
                    capabilities: {
                        basic_chat: true,
                        minimal_mode: true
                    },
                    cartrita_message: "I'm locked and loaded in minimal mode! 🚀"
                }
            };
        });

        // Catch-all for missing endpoints
        this.fastify.setNotFoundHandler(async (request, reply) => {
            logger.info(`🔍 Route not found: ${request.method} ${request.url}`);
            
            reply.status(404).send({
                success: false,
                error: 'Route not found',
                message: `Yo, I couldn't find ${request.url}. I'm running minimal mode right now!`,
                availableRoutes: ['/health', '/api/v2', '/api/chat'],
                cartritaNote: "Check out /docs for what's available! 📚"
            });
        });
    }

    async setupDocumentation() {
        await this.fastify.register(fastifySwagger, {
            openapi: {
                openapi: '3.0.0',
                info: {
                    title: 'Cartrita V2 Minimal API',
                    version: '2.0.0-minimal'
                }
            }
        });

        await this.fastify.register(fastifySwaggerUi, {
            routePrefix: '/docs',
            uiConfig: {
                docExpansion: 'list'
            }
        });
    }

    async start(port = 8000, host = '0.0.0.0') {
        try {
            if (!this.isInitialized) {
                await this.createServer();
            }

            await this.fastify.listen({ port, host });

            console.log(`
🌟 ============================================ 🌟
    CARTRITA V2 MINIMAL - RUNNING & READY!     
🌟 ============================================ 🌟

🔥 Status: OPERATIONAL
📍 Address: http://${host}:${port}
🧠 Mode: MINIMAL BUT MIGHTY
📚 Documentation: http://${host}:${port}/docs

Cartrita says: "I'm up and running minimal mode - 
ready to connect with the frontend! 💪🚀"
            `);

            return this.fastify;
        } catch (error) {
            logger.error('💥 Failed to start Cartrita V2 Minimal Server:', error);
            throw error;
        }
    }

    async stop() {
        if (this.fastify) {
            await this.fastify.close();
        }
        logger.info('✅ Cartrita V2 Minimal Server stopped');
    }
}

export const cartritaMinimalServer = new CartritaV2MinimalServer();
export default CartritaV2MinimalServer;