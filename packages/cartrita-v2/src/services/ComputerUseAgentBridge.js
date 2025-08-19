/**
 * Cartrita V2 - Computer Use Agent Bridge
 * Node.js service to manage Python Computer Use Agents
 */

import { spawn, exec } from 'child_process';
import path from 'path';
import { promises as fs } from 'fs';
import EventEmitter from 'events';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class ComputerUseAgentBridge extends EventEmitter {
    constructor(logger, tracing) {
        super();
        this.logger = logger;
        this.tracing = tracing;
        this.pythonProcess = null;
        this.agents = new Map();
        this.isInitialized = false;
        this.agentScriptPath = path.join(__dirname, '..', 'agents', 'computer_use_agent.py');
        this.transactionHistory = [];
    }

    async initialize() {
        return this.tracing.traceOperation('computer_use_agent_bridge.initialize', async () => {
            try {
                // Check if Python script exists
                await fs.access(this.agentScriptPath);
                
                // Check Python dependencies
                const deps = await this.checkPythonDependencies();
                if (!deps.satisfied) {
                    this.logger.warn('Computer Use Agent dependencies not satisfied', {
                        missing: deps.missing,
                        suggestion: 'Run: pip install openai langchain-openai pydantic pyautogui pillow'
                    });
                }

                this.isInitialized = true;
                this.logger.info('Computer Use Agent Bridge initialized', {
                    scriptPath: this.agentScriptPath,
                    dependenciesSatisfied: deps.satisfied
                });

                return {
                    success: true,
                    dependenciesSatisfied: deps.satisfied,
                    missing: deps.missing
                };

            } catch (error) {
                this.logger.error('Failed to initialize Computer Use Agent Bridge', { error: error.message });
                throw error;
            }
        });
    }

    async checkPythonDependencies() {
        return new Promise((resolve) => {
            const checkScript = `
import sys
import json

dependencies = {
    'openai': False,
    'langchain_openai': False,
    'pydantic': False,
    'pyautogui': False,
    'PIL': False
}

missing = []

for dep in dependencies:
    try:
        if dep == 'PIL':
            import PIL
        else:
            __import__(dep)
        dependencies[dep] = True
    except ImportError:
        missing.append(dep)

result = {
    'satisfied': len(missing) == 0,
    'dependencies': dependencies,
    'missing': missing
}

print(json.dumps(result))
`;

            exec(`python3 -c "${checkScript}"`, (error, stdout, stderr) => {
                if (error) {
                    resolve({
                        satisfied: false,
                        missing: ['python3', 'all_dependencies'],
                        error: error.message
                    });
                    return;
                }

                try {
                    const result = JSON.parse(stdout.trim());
                    resolve(result);
                } catch (parseError) {
                    resolve({
                        satisfied: false,
                        missing: ['json_parse_error'],
                        error: parseError.message
                    });
                }
            });
        });
    }

    async createAgent(agentName, permissionLevel = 'SUPERVISED', options = {}) {
        if (!this.isInitialized) {
            throw new Error('Bridge not initialized. Call initialize() first.');
        }

        const agentId = `cua_${agentName}_${Date.now()}`;

        const agentConfig = {
            id: agentId,
            name: agentName,
            permissionLevel,
            options,
            createdAt: new Date().toISOString(),
            status: 'created',
            transactionCount: 0,
            ...options
        };

        this.agents.set(agentId, agentConfig);

        this.logger.info('Computer Use Agent created', {
            agentId,
            agentName,
            permissionLevel
        });

        this.emit('agentCreated', agentConfig);

        return {
            success: true,
            agentId,
            agentConfig
        };
    }

    async executeComputerTask(agentId, task, options = {}) {
        return this.tracing.traceOperation('computer_use_agent.execute_task', async () => {
            const agent = this.agents.get(agentId);
            if (!agent) {
                throw new Error(`Agent ${agentId} not found`);
            }

            // Create execution ID for tracking
            const executionId = `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

            const execution = {
                executionId,
                agentId,
                task,
                options,
                status: 'starting',
                startTime: new Date().toISOString(),
                transactions: []
            };

            this.transactionHistory.push(execution);

            try {
                // Execute Python script with task parameters
                const result = await this.executePythonAgent(agentId, task, options);

                execution.status = 'completed';
                execution.endTime = new Date().toISOString();
                execution.result = result;

                // Update agent transaction count
                agent.transactionCount++;
                agent.lastExecution = new Date().toISOString();

                this.logger.info('Computer task executed successfully', {
                    executionId,
                    agentId,
                    taskLength: task.length,
                    duration: execution.endTime - execution.startTime
                });

                this.emit('taskCompleted', execution);

                return {
                    success: true,
                    executionId,
                    result
                };

            } catch (error) {
                execution.status = 'failed';
                execution.endTime = new Date().toISOString();
                execution.error = error.message;

                this.logger.error('Computer task execution failed', {
                    executionId,
                    agentId,
                    error: error.message
                });

                this.emit('taskFailed', execution);

                throw error;
            }
        });
    }

    async executePythonAgent(agentId, task, options = {}) {
        return new Promise((resolve, reject) => {
            // Prepare task data
            const taskData = {
                agent_id: agentId,
                task: task,
                max_iterations: options.maxIterations || 10,
                display_width: options.displayWidth || 1024,
                display_height: options.displayHeight || 768,
                environment: options.environment || 'ubuntu',
                justification: options.justification || 'User requested task execution',
                supervisor_id: 'supervisor_cartrita_v2',
                timestamp: new Date().toISOString()
            };

            // Create temporary task file
            const taskFile = path.join(__dirname, '..', 'temp', `task_${agentId}_${Date.now()}.json`);

            // Write task data to file
            fs.writeFile(taskFile, JSON.stringify(taskData, null, 2))
                .then(() => {
                    // Execute Python script
                    const pythonProcess = spawn('python3', [
                        this.agentScriptPath,
                        '--task-file', taskFile
                    ], {
                        stdio: ['pipe', 'pipe', 'pipe'],
                        env: {
                            ...process.env,
                            PYTHONUNBUFFERED: '1'
                        }
                    });

                    let stdout = '';
                    let stderr = '';

                    pythonProcess.stdout.on('data', (data) => {
                        stdout += data.toString();
                        // Emit real-time updates
                        this.emit('taskProgress', {
                            agentId,
                            data: data.toString()
                        });
                    });

                    pythonProcess.stderr.on('data', (data) => {
                        stderr += data.toString();
                        this.logger.warn('Python agent stderr', {
                            agentId,
                            data: data.toString()
                        });
                    });

                    pythonProcess.on('close', (code) => {
                        // Cleanup task file
                        fs.unlink(taskFile).catch(err => {
                            this.logger.warn('Failed to cleanup task file', { error: err.message });
                        });

                        if (code === 0) {
                            try {
                                // Parse JSON result from stdout
                                const lines = stdout.trim().split('\n');
                                const lastLine = lines[lines.length - 1];
                                const result = JSON.parse(lastLine);
                                resolve(result);
                            } catch (parseError) {
                                this.logger.error('Failed to parse Python agent result', {
                                    stdout,
                                    parseError: parseError.message
                                });
                                resolve({
                                    success: false,
                                    error: 'Failed to parse result',
                                    stdout,
                                    stderr
                                });
                            }
                        } else {
                            reject(new Error(`Python process exited with code ${code}: ${stderr}`));
                        }
                    });

                    pythonProcess.on('error', (error) => {
                        reject(new Error(`Failed to start Python process: ${error.message}`));
                    });
                })
                .catch(reject);
        });
    }

    async requestComputerAccess(agentId, taskDescription, justification) {
        return this.tracing.traceOperation('computer_use_agent.request_access', async () => {
            const agent = this.agents.get(agentId);
            if (!agent) {
                throw new Error(`Agent ${agentId} not found`);
            }

            // Create access request
            const accessRequest = {
                requestId: `access_${Date.now()}`,
                agentId,
                taskDescription,
                justification,
                status: 'pending',
                timestamp: new Date().toISOString()
            };

            // For supervised agents, auto-approve safe operations
            const safeOperations = [
                'screenshot',
                'analyze screen',
                'take screenshot',
                'view desktop'
            ];

            const isSafeOperation = safeOperations.some(op => 
                taskDescription.toLowerCase().includes(op)
            );

            if (agent.permissionLevel === 'SUPERVISED' && isSafeOperation) {
                accessRequest.status = 'approved';
                accessRequest.approvedAt = new Date().toISOString();
                accessRequest.approver = 'auto_supervisor';

                this.logger.info('Computer access auto-approved', {
                    agentId,
                    requestId: accessRequest.requestId,
                    reason: 'safe_operation'
                });
            } else {
                // Require manual approval for unsafe operations
                accessRequest.status = 'requires_manual_approval';
                this.logger.warn('Computer access requires manual approval', {
                    agentId,
                    taskDescription,
                    reason: 'unsafe_operation'
                });
            }

            this.emit('accessRequested', accessRequest);

            return {
                success: true,
                accessRequest
            };
        });
    }

    getAgentStatus(agentId) {
        const agent = this.agents.get(agentId);
        if (!agent) {
            return null;
        }

        const recentTransactions = this.transactionHistory
            .filter(t => t.agentId === agentId)
            .slice(-10);

        return {
            ...agent,
            recentTransactions,
            bridgeStatus: {
                initialized: this.isInitialized,
                pythonAvailable: true // We've already checked this
            }
        };
    }

    listAgents() {
        return Array.from(this.agents.values()).map(agent => ({
            ...agent,
            transactionCount: this.transactionHistory.filter(t => t.agentId === agent.id).length
        }));
    }

    getSystemStatus() {
        return {
            bridge: {
                initialized: this.isInitialized,
                scriptPath: this.agentScriptPath,
                agentCount: this.agents.size
            },
            agents: this.listAgents(),
            transactions: {
                total: this.transactionHistory.length,
                recent: this.transactionHistory.slice(-20)
            },
            capabilities: {
                computerControl: true,
                visionAnalysis: true,
                webAutomation: true,
                applicationControl: true,
                screenCapture: true
            },
            timestamp: new Date().toISOString()
        };
    }

    async cleanup() {
        this.logger.info('Cleaning up Computer Use Agent Bridge');
        
        if (this.pythonProcess) {
            this.pythonProcess.kill();
            this.pythonProcess = null;
        }

        this.agents.clear();
        this.transactionHistory = [];
        this.isInitialized = false;

        this.emit('bridgeCleanup');
    }
}

export default ComputerUseAgentBridge;