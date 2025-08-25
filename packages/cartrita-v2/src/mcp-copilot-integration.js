/**
 * Node.js MCP Integration for GitHub Copilot Delegation Agent
 * Bridges the Python copilot delegation service with the Node.js backend
 */

const { spawn } = require('child_process');
const axios = require('axios');
const path = require('path');

class NodeMCPCopilotBridge {
    constructor(options = {}) {
        this.serviceName = 'copilot_delegation_bridge';
        this.version = '2.0.0';
        this.description = 'Node.js bridge for Python GitHub Copilot delegation service';
        
        this.pythonServiceUrl = options.pythonServiceUrl || 'http://localhost:8003';
        this.pythonScriptPath = options.pythonScriptPath || path.join(__dirname, '../mcp_copilot_delegation.py');
        
        // Service capabilities
        this.capabilities = [
            'python_bridge',
            'copilot_delegation',
            'project_analysis',
            'task_planning',
            'gui_automation_bridge',
            'mcp_routing'
        ];
        
        // Available endpoints for Express.js
        this.endpoints = {
            'POST /api/mcp/copilot/start-session': 'startDelegationSession',
            'POST /api/mcp/copilot/analyze-project': 'analyzeProject',
            'POST /api/mcp/copilot/create-instructions': 'createCopilotInstructions',
            'POST /api/mcp/copilot/simulate-delegation': 'simulateDelgation',
            'GET /api/mcp/copilot/status': 'getServiceStatus',
            'GET /api/mcp/copilot/manifest': 'getMCPManifest'
        };
        
        console.log(`🌉 Node.js MCP Copilot Bridge initialized`);
        console.log(`   Service: ${this.serviceName} v${this.version}`);
        console.log(`   Python Service URL: ${this.pythonServiceUrl}`);
        console.log(`   Endpoints: ${Object.keys(this.endpoints).length}`);
    }
    
    /**
     * Register Express.js routes for MCP copilot delegation
     */
    registerRoutes(app) {
        console.log('📡 Registering MCP Copilot delegation routes...');
        
        // Start delegation session
        app.post('/api/mcp/copilot/start-session', async (req, res) => {
            try {
                const { project_path, task_description, options } = req.body;
                
                if (!project_path || !task_description) {
                    return res.status(400).json({
                        success: false,
                        error: 'Missing required parameters: project_path, task_description',
                        service: this.serviceName
                    });
                }
                
                console.log(`🚀 Starting copilot delegation session: ${task_description.substring(0, 50)}...`);
                
                const result = await this.callPythonService('start_delegation_session', {
                    project_path,
                    task_description,
                    options
                });
                
                res.json({
                    ...result,
                    bridge_service: this.serviceName,
                    bridge_version: this.version
                });
                
            } catch (error) {
                console.error('❌ Start session failed:', error.message);
                res.status(500).json({
                    success: false,
                    error: error.message,
                    service: this.serviceName,
                    endpoint: '/api/mcp/copilot/start-session'
                });
            }
        });
        
        // Analyze project
        app.post('/api/mcp/copilot/analyze-project', async (req, res) => {
            try {
                const { project_path } = req.body;
                
                if (!project_path) {
                    return res.status(400).json({
                        success: false,
                        error: 'Missing required parameter: project_path',
                        service: this.serviceName
                    });
                }
                
                console.log(`🔍 Analyzing project: ${project_path}`);
                
                const result = await this.callPythonService('analyze_project', {
                    project_path
                });
                
                res.json({
                    ...result,
                    bridge_service: this.serviceName
                });
                
            } catch (error) {
                console.error('❌ Project analysis failed:', error.message);
                res.status(500).json({
                    success: false,
                    error: error.message,
                    service: this.serviceName
                });
            }
        });
        
        // Create copilot instructions
        app.post('/api/mcp/copilot/create-instructions', async (req, res) => {
            try {
                const { project_path, custom_procedures } = req.body;
                
                if (!project_path) {
                    return res.status(400).json({
                        success: false,
                        error: 'Missing required parameter: project_path',
                        service: this.serviceName
                    });
                }
                
                console.log(`📝 Creating copilot instructions: ${project_path}`);
                
                const result = await this.callPythonService('create_copilot_instructions', {
                    project_path,
                    custom_procedures
                });
                
                res.json({
                    ...result,
                    bridge_service: this.serviceName
                });
                
            } catch (error) {
                console.error('❌ Instructions creation failed:', error.message);
                res.status(500).json({
                    success: false,
                    error: error.message,
                    service: this.serviceName
                });
            }
        });
        
        // Simulate delegation
        app.post('/api/mcp/copilot/simulate-delegation', async (req, res) => {
            try {
                const { task_description, project_context } = req.body;
                
                if (!task_description) {
                    return res.status(400).json({
                        success: false,
                        error: 'Missing required parameter: task_description',
                        service: this.serviceName
                    });
                }
                
                console.log(`🔄 Simulating delegation: ${task_description.substring(0, 50)}...`);
                
                const result = await this.callPythonService('simulate_delegation', {
                    task_description,
                    project_context
                });
                
                res.json({
                    ...result,
                    bridge_service: this.serviceName
                });
                
            } catch (error) {
                console.error('❌ Delegation simulation failed:', error.message);
                res.status(500).json({
                    success: false,
                    error: error.message,
                    service: this.serviceName
                });
            }
        });
        
        // Get service status
        app.get('/api/mcp/copilot/status', async (req, res) => {
            try {
                console.log('📊 Getting MCP copilot service status');
                
                const pythonStatus = await this.callPythonService('get_service_status', {});
                
                const bridgeStatus = {
                    bridge_service: {
                        name: this.serviceName,
                        version: this.version,
                        description: this.description,
                        status: 'active',
                        python_service_url: this.pythonServiceUrl,
                        endpoints_registered: Object.keys(this.endpoints).length
                    },
                    python_service: pythonStatus,
                    hybrid_architecture: {
                        node_backend: 'active',
                        python_backend: pythonStatus.success ? 'connected' : 'disconnected',
                        bridge_operational: true
                    }
                };
                
                res.json({
                    success: true,
                    ...bridgeStatus,
                    capabilities: this.capabilities,
                    timestamp: new Date().toISOString()
                });
                
            } catch (error) {
                console.error('❌ Status check failed:', error.message);
                res.status(500).json({
                    success: false,
                    error: error.message,
                    service: this.serviceName,
                    python_service_available: false
                });
            }
        });
        
        // Get MCP manifest
        app.get('/api/mcp/copilot/manifest', (req, res) => {
            try {
                const manifest = {
                    name: this.serviceName,
                    version: this.version,
                    description: this.description,
                    type: 'hybrid_bridge',
                    architecture: {
                        frontend: 'node.js',
                        backend: 'python',
                        bridge: 'express_to_python'
                    },
                    capabilities: this.capabilities,
                    endpoints: Object.keys(this.endpoints),
                    integration: {
                        cartrita_node_backend: true,
                        cartrita_python_backend: true,
                        mcp_protocol: true,
                        gui_automation: true
                    },
                    dependencies: {
                        node: ['axios', 'express'],
                        python: ['openai', 'pyautogui', 'opencv-python']
                    }
                };
                
                res.json({
                    success: true,
                    manifest,
                    timestamp: new Date().toISOString()
                });
                
            } catch (error) {
                console.error('❌ Manifest generation failed:', error.message);
                res.status(500).json({
                    success: false,
                    error: error.message,
                    service: this.serviceName
                });
            }
        });
        
        console.log(`✅ ${Object.keys(this.endpoints).length} MCP Copilot routes registered`);
    }
    
    /**
     * Call Python MCP service via direct import or HTTP
     */
    async callPythonService(tool_name, parameters) {
        try {
            // Try direct Python execution first
            const result = await this.executePythonScript(tool_name, parameters);
            return result;
            
        } catch (directError) {
            console.warn('Direct Python execution failed, trying HTTP:', directError.message);
            
            try {
                // Fallback to HTTP call if Python service is running separately
                const response = await axios.post(`${this.pythonServiceUrl}/api/mcp/copilot`, {
                    tool: tool_name,
                    parameters
                });
                
                return response.data;
                
            } catch (httpError) {
                throw new Error(`Both direct and HTTP Python calls failed: ${directError.message}, ${httpError.message}`);
            }
        }
    }
    
    /**
     * Execute Python script directly
     */
    executePythonScript(tool_name, parameters) {
        return new Promise((resolve, reject) => {
            const pythonProcess = spawn('python3', [
                this.pythonScriptPath,
                '--tool', tool_name,
                '--parameters', JSON.stringify(parameters)
            ]);
            
            let stdout = '';
            let stderr = '';
            
            pythonProcess.stdout.on('data', (data) => {
                stdout += data.toString();
            });
            
            pythonProcess.stderr.on('data', (data) => {
                stderr += data.toString();
            });
            
            pythonProcess.on('close', (code) => {
                if (code === 0) {
                    try {
                        const result = JSON.parse(stdout);
                        resolve(result);
                    } catch (parseError) {
                        reject(new Error(`Python script output parsing failed: ${parseError.message}`));
                    }
                } else {
                    reject(new Error(`Python script failed with code ${code}: ${stderr}`));
                }
            });
            
            pythonProcess.on('error', (error) => {
                reject(new Error(`Python script execution failed: ${error.message}`));
            });
        });
    }
    
    /**
     * Health check for the bridge service
     */
    async healthCheck() {
        try {
            const pythonStatus = await this.callPythonService('get_service_status', {});
            
            return {
                bridge_healthy: true,
                python_service_healthy: pythonStatus.success || false,
                capabilities_available: this.capabilities,
                last_check: new Date().toISOString()
            };
            
        } catch (error) {
            return {
                bridge_healthy: true,
                python_service_healthy: false,
                error: error.message,
                last_check: new Date().toISOString()
            };
        }
    }
}

module.exports = NodeMCPCopilotBridge;