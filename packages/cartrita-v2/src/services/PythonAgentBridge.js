/**
 * Cartrita V2 - Python Agent Bridge
 * Connects Node.js backend with Python FastAPI agents
 */

const axios = require('axios');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs').promises;
const EventEmitter = require('events');

class PythonAgentBridge extends EventEmitter {
    constructor(options = {}) {
        super();
        
        this.pythonServerUrl = options.pythonServerUrl || 'http://localhost:9002';
        this.pythonServerProcess = null;
        this.isServerRunning = false;
        this.connectionRetries = 0;
        this.maxRetries = 10;
        
        // HTTP client configuration
        this.httpClient = axios.create({
            baseURL: this.pythonServerUrl,
            timeout: 30000,
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        this.logger = console; // Will be injected with proper logger
    }
    
    /**
     * Initialize the Python agent bridge
     */
    async initialize(logger) {
        this.logger = logger || console;
        
        try {
            this.logger.info('🔗 Initializing Python Agent Bridge');
            
            // Check if Python server is already running
            const isRunning = await this.checkPythonServer();
            
            if (!isRunning && !process.env.SKIP_PYTHON_START) {
                this.logger.info('🐍 Starting Python FastAPI server');
                await this.startPythonServer();
            } else if (isRunning) {
                this.logger.info('✅ Python server already running');
                this.isServerRunning = true;
            } else {
                this.logger.info('⏭️ Skipping Python server startup (SKIP_PYTHON_START=true)');
                this.isServerRunning = true; // Assume it's running externally
            }
            
            // Wait for server to be ready
            await this.waitForServer();
            
            this.logger.info('✅ Python Agent Bridge initialized successfully');
            this.emit('ready');
            
        } catch (error) {
            this.logger.error('❌ Failed to initialize Python Agent Bridge:', error);
            throw error;
        }
    }
    
    /**
     * Check if Python server is running
     */
    async checkPythonServer() {
        try {
            const response = await this.httpClient.get('/health', { timeout: 5000 });
            return response.status === 200;
        } catch (error) {
            return false;
        }
    }
    
    /**
     * Start the Python FastAPI server
     */
    async startPythonServer() {
        return new Promise((resolve, reject) => {
            const pythonDir = path.join(__dirname, '../../py');
            
            // Start Python server using uvicorn with main.py
            this.pythonServerProcess = spawn('/home/robbie/development/dat-bitch-cartrita/packages/cartrita-v2/.venv/bin/python', ['-m', 'uvicorn', 'main:app', '--reload', '--port', '9002'], {
                stdio: ['pipe', 'pipe', 'pipe'],
                cwd: pythonDir,
                env: {
                    ...process.env,
                    PYTHONPATH: pythonDir,
                    PORT: '9002'
                }
            });
            
            this.pythonServerProcess.stdout.on('data', (data) => {
                this.logger.info(`🐍 Python Server: ${data.toString().trim()}`);
                
                // Check for server startup completion
                if (data.toString().includes('Uvicorn running')) {
                    this.isServerRunning = true;
                    resolve();
                }
            });
            
            this.pythonServerProcess.stderr.on('data', (data) => {
                const message = data.toString().trim();
                if (!message.includes('WARNING') && !message.includes('INFO')) {
                    this.logger.error(`🐍 Python Server Error: ${message}`);
                }
            });
            
            this.pythonServerProcess.on('error', (error) => {
                this.logger.error('❌ Failed to start Python server:', error);
                reject(error);
            });
            
            this.pythonServerProcess.on('exit', (code) => {
                this.logger.warn(`🐍 Python server exited with code ${code}`);
                this.isServerRunning = false;
                this.emit('serverExit', code);
            });
            
            // Timeout fallback
            setTimeout(() => {
                if (!this.isServerRunning) {
                    this.logger.info('🐍 Python server startup timeout, assuming ready');
                    resolve();
                }
            }, 10000);
        });
    }
    
    /**
     * Wait for server to be ready
     */
    async waitForServer() {
        while (this.connectionRetries < this.maxRetries) {
            try {
                const response = await this.httpClient.get('/health');
                if (response.status === 200) {
                    this.logger.info('✅ Python server is ready');
                    return true;
                }
            } catch (error) {
                this.connectionRetries++;
                this.logger.info(`⏳ Waiting for Python server... (${this.connectionRetries}/${this.maxRetries})`);
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }
        
        throw new Error('Python server failed to start within timeout period');
    }
    
    /**
     * Send chat message to Python agents
     */
    async sendChatMessage(message, options = {}) {
        try {
            const requestData = {
                message,
                user_id: options.userId || 'anonymous',
                session_id: options.sessionId,
                priority: options.priority || 'medium',
                preferred_agent: options.preferredAgent,
                context: options.context || {}
            };
            
            this.logger.info(`💬 Sending chat to Python agents: ${message.substring(0, 50)}...`);
            
            const response = await this.httpClient.post('/api/v2/chat', requestData);
            
            return {
                success: true,
                data: response.data,
                source: 'python_agents'
            };
            
        } catch (error) {
            this.logger.error('❌ Chat message failed:', error.message);
            return {
                success: false,
                error: error.message,
                source: 'python_agents'
            };
        }
    }
    
    /**
     * Execute computer use task
     */
    async executeComputerUse(taskDescription, options = {}) {
        try {
            const requestData = {
                task_description: taskDescription,
                user_id: options.userId || 'anonymous',
                session_id: options.sessionId,
                max_iterations: options.maxIterations || 10,
                display_width: options.displayWidth || 1024,
                display_height: options.displayHeight || 768,
                environment: options.environment || 'ubuntu'
            };
            
            this.logger.info(`🖥️ Executing computer use task: ${taskDescription.substring(0, 50)}...`);
            
            const response = await this.httpClient.post('/api/v2/computer-use', requestData);
            
            return {
                success: true,
                data: response.data,
                source: 'computer_use_agent'
            };
            
        } catch (error) {
            this.logger.error('❌ Computer use task failed:', error.message);
            return {
                success: false,
                error: error.message,
                source: 'computer_use_agent'
            };
        }
    }
    
    /**
     * Get agent status from Python backend
     */
    async getAgentStatus() {
        try {
            const response = await this.httpClient.get('/api/v2/agents/status');
            
            return {
                success: true,
                data: response.data,
                source: 'python_agents'
            };
            
        } catch (error) {
            this.logger.error('❌ Failed to get agent status:', error.message);
            return {
                success: false,
                error: error.message,
                source: 'python_agents'
            };
        }
    }
    
    /**
     * Get health status
     */
    async getHealth() {
        try {
            const response = await this.httpClient.get('/health');
            
            return {
                success: true,
                data: response.data,
                source: 'python_backend',
                bridge_status: 'connected'
            };
            
        } catch (error) {
            return {
                success: false,
                error: error.message,
                source: 'python_backend',
                bridge_status: 'disconnected'
            };
        }
    }
    
    /**
     * Shutdown the bridge and Python server
     */
    async shutdown() {
        this.logger.info('🛑 Shutting down Python Agent Bridge');
        
        if (this.pythonServerProcess) {
            this.pythonServerProcess.kill('SIGTERM');
            
            // Give process time to shutdown gracefully
            await new Promise(resolve => {
                const timeout = setTimeout(() => {
                    this.pythonServerProcess.kill('SIGKILL');
                    resolve();
                }, 5000);
                
                this.pythonServerProcess.on('exit', () => {
                    clearTimeout(timeout);
                    resolve();
                });
            });
            
            this.pythonServerProcess = null;
        }
        
        this.isServerRunning = false;
        this.emit('shutdown');
    }
    
    /**
     * Get bridge status
     */
    getStatus() {
        return {
            bridge_active: true,
            python_server_running: this.isServerRunning,
            python_server_url: this.pythonServerUrl,
            connection_retries: this.connectionRetries,
            process_id: this.pythonServerProcess?.pid || null,
            timestamp: new Date().toISOString()
        };
    }
}

module.exports = PythonAgentBridge;