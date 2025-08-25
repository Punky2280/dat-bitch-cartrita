/**
 * Cartrita V2 - Core Orchestrator
 * Manages hybrid Node.js + Python multi-agent system
 */

const EventEmitter = require('events');
const PythonAgentBridge = require('./PythonAgentBridge');

class CartritaCoreOrchestrator extends EventEmitter {
    constructor(options = {}) {
        super();
        
        this.options = {
            pythonServerUrl: options.pythonServerUrl || 'http://localhost:8002',
            enableNodeAgents: options.enableNodeAgents !== false,
            enablePythonAgents: options.enablePythonAgents !== false,
            defaultRoutingStrategy: options.defaultRoutingStrategy || 'intelligent',
            ...options
        };
        
        // Core components
        this.pythonBridge = new PythonAgentBridge({
            pythonServerUrl: this.options.pythonServerUrl
        });
        
        this.nodeAgents = new Map(); // Node.js agents registry
        this.routingRules = new Map(); // Task routing rules
        this.activeConversations = new Map(); // Active conversation sessions
        
        // Performance tracking
        this.stats = {
            totalRequests: 0,
            pythonRequests: 0,
            nodeRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            averageResponseTime: 0,
            lastActivity: null
        };
        
        this.logger = console; // Will be injected
        
        // Setup routing rules
        this.setupDefaultRouting();
    }
    
    /**
     * Initialize the core orchestrator
     */
    async initialize(logger, nodeAgentRegistry = null) {
        this.logger = logger || console;
        
        try {
            this.logger.info('🎭 Initializing Cartrita Core Orchestrator');
            
            // Initialize Python bridge if enabled
            if (this.options.enablePythonAgents) {
                await this.pythonBridge.initialize(this.logger);
                
                // Set up bridge event handlers
                this.pythonBridge.on('ready', () => {
                    this.logger.info('✅ Python agents ready');
                    this.emit('pythonReady');
                });
                
                this.pythonBridge.on('serverExit', (code) => {
                    this.logger.warn(`⚠️ Python server exited with code ${code}`);
                    this.emit('pythonDown', code);
                });
            }
            
            // Register Node.js agents if provided
            if (nodeAgentRegistry && this.options.enableNodeAgents) {
                this.registerNodeAgents(nodeAgentRegistry);
            }
            
            this.logger.info('✅ Cartrita Core Orchestrator initialized');
            this.emit('ready');
            
        } catch (error) {
            this.logger.error('❌ Failed to initialize Core Orchestrator:', error);
            throw error;
        }
    }
    
    /**
     * Setup default routing rules
     */
    setupDefaultRouting() {
        // Computer use tasks -> Python agents
        this.routingRules.set('computer_use', {
            backend: 'python',
            agent: 'computer_use_agent_v2',
            description: 'Computer automation and GUI interaction'
        });
        
        // Research tasks -> Python agents (better web search)
        this.routingRules.set('research', {
            backend: 'python',
            agent: 'research_agent_v2',
            description: 'Web research and information gathering'
        });
        
        // Content creation -> Python agents (OpenAI Responses API)
        this.routingRules.set('content_creation', {
            backend: 'python',
            agent: 'writer_agent_v2',
            description: 'Content creation and writing'
        });
        
        // Vision tasks -> Python agents (better image analysis)
        this.routingRules.set('vision', {
            backend: 'python',
            agent: 'vision_agent_v2',
            description: 'Image analysis and computer vision'
        });
        
        // Code generation -> Python agents (OpenAI latest models)
        this.routingRules.set('code_generation', {
            backend: 'python',
            agent: 'code_writer_agent_v2',
            description: 'Code generation and programming'
        });
    }
    
    /**
     * Main entry point for processing user requests
     */
    async processRequest(request) {
        const startTime = Date.now();
        this.stats.totalRequests++;
        this.stats.lastActivity = new Date();
        
        try {
            this.logger.info(`🎯 Processing request: ${request.message?.substring(0, 50) || 'Unknown'}...`);
            
            // Determine routing strategy
            const routing = await this.determineRouting(request);
            
            // Route to appropriate backend
            let response;
            if (routing.backend === 'python') {
                response = await this.routeToPython(request, routing);
                this.stats.pythonRequests++;
            } else {
                // Fallback to Python for unknown routing
                response = await this.routeToPython(request, routing);
                this.stats.pythonRequests++;
            }
            
            // Update performance metrics
            const responseTime = Date.now() - startTime;
            this.updatePerformanceMetrics(responseTime, true);
            
            // Add orchestrator metadata
            response.orchestrator_metadata = {
                routing_decision: routing,
                response_time_ms: responseTime,
                backend_used: routing.backend,
                agent_used: routing.agent,
                timestamp: new Date().toISOString()
            };
            
            this.logger.info(`✅ Request processed in ${responseTime}ms via ${routing.backend}`);
            return response;
            
        } catch (error) {
            const responseTime = Date.now() - startTime;
            this.updatePerformanceMetrics(responseTime, false);
            
            this.logger.error('❌ Request processing failed:', error);
            
            return {
                success: false,
                error: error.message,
                orchestrator_metadata: {
                    error: true,
                    response_time_ms: responseTime,
                    timestamp: new Date().toISOString()
                }
            };
        }
    }
    
    /**
     * Determine routing for a request
     */
    async determineRouting(request) {
        const message = request.message?.toLowerCase() || '';
        const preferredAgent = request.preferredAgent;
        
        // Direct agent preference
        if (preferredAgent) {
            if (preferredAgent.includes('_v2') || preferredAgent.includes('python')) {
                return { backend: 'python', agent: preferredAgent };
            }
        }
        
        // Computer use detection
        if (this.isComputerUseRequest(message)) {
            return this.routingRules.get('computer_use');
        }
        
        // Research detection
        if (this.isResearchRequest(message)) {
            return this.routingRules.get('research');
        }
        
        // Vision detection
        if (this.isVisionRequest(message, request)) {
            return this.routingRules.get('vision');
        }
        
        // Code generation detection
        if (this.isCodeGenerationRequest(message)) {
            return this.routingRules.get('code_generation');
        }
        
        // Content creation detection
        if (this.isContentCreationRequest(message)) {
            return this.routingRules.get('content_creation');
        }
        
        // Default to Python agents for general AI tasks
        return {
            backend: 'python',
            agent: 'supervisor_cartrita_v2',
            description: 'General AI assistance'
        };
    }
    
    /**
     * Route request to Python backend
     */
    async routeToPython(request, routing) {
        try {
            // Check for computer use requests
            if (routing.agent === 'computer_use_agent_v2' || this.isComputerUseRequest(request.message)) {
                return await this.pythonBridge.executeComputerUse(request.message, {
                    userId: request.userId,
                    sessionId: request.sessionId,
                    maxIterations: request.maxIterations,
                    displayWidth: request.displayWidth,
                    displayHeight: request.displayHeight,
                    environment: request.environment
                });
            }
            
            // Regular chat request
            return await this.pythonBridge.sendChatMessage(request.message, {
                userId: request.userId,
                sessionId: request.sessionId,
                priority: request.priority,
                preferredAgent: routing.agent,
                context: request.context
            });
            
        } catch (error) {
            this.logger.error('❌ Python routing failed:', error);
            throw error;
        }
    }
    
    /**
     * Request classification methods
     */
    isComputerUseRequest(message) {
        const computerKeywords = [
            'screenshot', 'click', 'type', 'scroll', 'navigate', 'browse',
            'open application', 'close window', 'desktop', 'mouse', 'keyboard',
            'automate', 'gui', 'interface', 'window', 'button', 'menu'
        ];
        
        return computerKeywords.some(keyword => message.includes(keyword));
    }
    
    isResearchRequest(message) {
        const researchKeywords = [
            'search', 'research', 'find information', 'look up', 'investigate',
            'gather data', 'fact check', 'verify', 'web search', 'current events'
        ];
        
        return researchKeywords.some(keyword => message.includes(keyword));
    }
    
    isVisionRequest(message, request) {
        const visionKeywords = [
            'image', 'picture', 'photo', 'visual', 'analyze', 'describe',
            'ocr', 'text in image', 'computer vision', 'visual analysis'
        ];
        
        return visionKeywords.some(keyword => message.includes(keyword)) ||
               request.hasImages || request.attachments?.some(a => a.type?.startsWith('image/'));
    }
    
    isCodeGenerationRequest(message) {
        const codeKeywords = [
            'code', 'program', 'script', 'function', 'class', 'algorithm',
            'debug', 'refactor', 'implement', 'programming', 'software',
            'javascript', 'python', 'java', 'c++', 'html', 'css'
        ];
        
        return codeKeywords.some(keyword => message.includes(keyword));
    }
    
    isContentCreationRequest(message) {
        const contentKeywords = [
            'write', 'create', 'compose', 'draft', 'article', 'blog',
            'essay', 'story', 'content', 'copy', 'documentation', 'report'
        ];
        
        return contentKeywords.some(keyword => message.includes(keyword));
    }
    
    /**
     * Update performance metrics
     */
    updatePerformanceMetrics(responseTime, success) {
        if (success) {
            this.stats.successfulRequests++;
        } else {
            this.stats.failedRequests++;
        }
        
        // Exponential moving average for response time
        const alpha = 0.1;
        this.stats.averageResponseTime = 
            alpha * responseTime + (1 - alpha) * this.stats.averageResponseTime;
    }
    
    /**
     * Get orchestrator status
     */
    async getStatus() {
        const pythonHealth = await this.pythonBridge.getHealth();
        const pythonStatus = await this.pythonBridge.getAgentStatus();
        
        return {
            orchestrator: {
                status: 'active',
                routing_strategy: this.options.defaultRoutingStrategy,
                active_conversations: this.activeConversations.size,
                routing_rules: Array.from(this.routingRules.entries()).map(([key, rule]) => ({
                    task_type: key,
                    ...rule
                }))
            },
            backends: {
                python: {
                    enabled: this.options.enablePythonAgents,
                    health: pythonHealth,
                    agents: pythonStatus.success ? pythonStatus.data : null
                },
                node: {
                    enabled: this.options.enableNodeAgents,
                    agents_registered: this.nodeAgents.size
                }
            },
            performance: this.stats,
            timestamp: new Date().toISOString()
        };
    }
    
    /**
     * Shutdown orchestrator
     */
    async shutdown() {
        this.logger.info('🛑 Shutting down Cartrita Core Orchestrator');
        
        if (this.options.enablePythonAgents) {
            await this.pythonBridge.shutdown();
        }
        
        this.emit('shutdown');
    }
}

module.exports = CartritaCoreOrchestrator;