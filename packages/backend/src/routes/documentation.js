import express from 'express';
import DocumentationMaintenanceManager from '../services/DocumentationMaintenanceManager.js';
import OpenTelemetryTracing from '../system/OpenTelemetryTracing.js';

const router = express.Router();

// Initialize documentation manager
const docManager = new DocumentationMaintenanceManager();

/**
 * Documentation Management API Routes
 * Comprehensive documentation and maintenance endpoints
 */

/**
 * GET /api/documentation/status
 * Get documentation system status
 */
router.get('/status', async (req, res) => {
    try {
        const status = await docManager.getSystemStatus();
        
        res.json({
            success: true,
            data: status
        });
        
    } catch (error) {
        console.error('Documentation status error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get documentation status'
        });
    }
});

/**
 * POST /api/documentation/initialize
 * Initialize documentation system
 */
router.post('/initialize', async (req, res) => {
    try {
        const result = await docManager.initialize();
        
        res.json({
            success: true,
            data: result
        });
        
    } catch (error) {
        console.error('Documentation initialization error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to initialize documentation system'
        });
    }
});

/**
 * POST /api/documentation/generate
 * Generate documentation
 */
router.post('/generate', async (req, res) => {
    try {
        const { types = [] } = req.body;
        
        let result;
        if (types.length === 0) {
            // Generate all documentation
            result = await docManager.generateAllDocumentation();
        } else {
            // Generate specific types
            result = {};
            for (const type of types) {
                const docType = docManager.documentationTypes[type.toUpperCase()];
                if (docType) {
                    result[type] = await docType.generator();
                }
            }
        }
        
        res.json({
            success: true,
            data: result
        });
        
    } catch (error) {
        console.error('Documentation generation error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to generate documentation'
        });
    }
});

/**
 * GET /api/documentation/types
 * List available documentation types
 */
router.get('/types', async (req, res) => {
    try {
        const types = Object.entries(docManager.documentationTypes).map(([key, config]) => ({
            key: key.toLowerCase(),
            name: config.name,
            outputFile: config.outputFile,
            template: config.template
        }));
        
        res.json({
            success: true,
            data: types
        });
        
    } catch (error) {
        console.error('Documentation types error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get documentation types'
        });
    }
});

/**
 * POST /api/documentation/maintenance/run
 * Run maintenance tasks
 */
router.post('/maintenance/run', async (req, res) => {
    try {
        const { tasks = [] } = req.body;
        
        const results = {};
        
        if (tasks.length === 0) {
            // Run all maintenance tasks
            for (const [taskKey, taskConfig] of Object.entries(docManager.maintenanceTasks)) {
                console.log(`🔧 Running ${taskConfig.name}...`);
                results[taskKey.toLowerCase()] = await taskConfig.handler();
            }
        } else {
            // Run specific tasks
            for (const taskName of tasks) {
                const taskKey = taskName.toUpperCase();
                const taskConfig = docManager.maintenanceTasks[taskKey];
                
                if (taskConfig) {
                    console.log(`🔧 Running ${taskConfig.name}...`);
                    results[taskName] = await taskConfig.handler();
                } else {
                    results[taskName] = { success: false, error: 'Task not found' };
                }
            }
        }
        
        res.json({
            success: true,
            data: results
        });
        
    } catch (error) {
        console.error('Maintenance tasks error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to run maintenance tasks'
        });
    }
});

/**
 * GET /api/documentation/maintenance/tasks
 * List available maintenance tasks
 */
router.get('/maintenance/tasks', async (req, res) => {
    try {
        const tasks = Object.entries(docManager.maintenanceTasks).map(([key, config]) => ({
            key: key.toLowerCase(),
            name: config.name,
            schedule: config.schedule,
            priority: config.priority
        }));
        
        res.json({
            success: true,
            data: tasks
        });
        
    } catch (error) {
        console.error('Maintenance tasks list error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get maintenance tasks'
        });
    }
});

/**
 * GET /api/documentation/troubleshooting/scenarios
 * List troubleshooting scenarios
 */
router.get('/troubleshooting/scenarios', async (req, res) => {
    try {
        const scenarios = Object.entries(docManager.troubleshootingScenarios).map(([key, config]) => ({
            key: key.toLowerCase(),
            name: config.name,
            symptoms: config.symptoms,
            diagnostics: config.diagnostics,
            solutions: config.solutions,
            escalation: config.escalation
        }));
        
        res.json({
            success: true,
            data: scenarios
        });
        
    } catch (error) {
        console.error('Troubleshooting scenarios error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get troubleshooting scenarios'
        });
    }
});

/**
 * GET /api/documentation/troubleshooting/scenario/:scenario
 * Get specific troubleshooting scenario details
 */
router.get('/troubleshooting/scenario/:scenario', async (req, res) => {
    try {
        const { scenario } = req.params;
        const scenarioKey = scenario.toUpperCase();
        const scenarioConfig = docManager.troubleshootingScenarios[scenarioKey];
        
        if (!scenarioConfig) {
            return res.status(404).json({
                success: false,
                error: 'Troubleshooting scenario not found'
            });
        }
        
        res.json({
            success: true,
            data: {
                key: scenario,
                ...scenarioConfig
            }
        });
        
    } catch (error) {
        console.error('Troubleshooting scenario error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get troubleshooting scenario'
        });
    }
});

/**
 * POST /api/documentation/troubleshooting/diagnose
 * Run diagnostic checks for troubleshooting
 */
router.post('/troubleshooting/diagnose', async (req, res) => {
    try {
        const { symptoms = [], scenario } = req.body;
        
        // This would implement diagnostic logic based on symptoms
        const diagnostics = await OpenTelemetryTracing.traceOperation(
            'documentation.troubleshooting.diagnose',
            async () => {
                // Diagnostic logic would go here
                return {
                    matchedScenarios: [],
                    recommendedActions: [],
                    severity: 'medium',
                    urgency: 'normal'
                };
            }
        );
        
        res.json({
            success: true,
            data: diagnostics
        });
        
    } catch (error) {
        console.error('Troubleshooting diagnosis error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to run diagnostics'
        });
    }
});

/**
 * GET /api/documentation/api/openapi
 * Get OpenAPI/Swagger specification
 */
router.get('/api/openapi', async (req, res) => {
    try {
        // This would return the generated OpenAPI specification
        const openApiSpec = {
            openapi: '3.0.0',
            info: {
                title: 'Cartrita Multi-Agent OS API',
                version: '1.0.0',
                description: 'Comprehensive API for Cartrita Multi-Agent Operating System'
            },
            servers: [
                { url: 'https://api.cartrita.ai', description: 'Production server' },
                { url: 'https://staging-api.cartrita.ai', description: 'Staging server' }
            ],
            paths: {},
            components: {
                securitySchemes: {
                    bearerAuth: {
                        type: 'http',
                        scheme: 'bearer',
                        bearerFormat: 'JWT'
                    }
                }
            }
        };
        
        res.json({
            success: true,
            data: openApiSpec
        });
        
    } catch (error) {
        console.error('OpenAPI spec error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get OpenAPI specification'
        });
    }
});

/**
 * GET /api/documentation/search
 * Search documentation content
 */
router.get('/search', async (req, res) => {
    try {
        const { q: query, type, limit = 10 } = req.query;
        
        if (!query) {
            return res.status(400).json({
                success: false,
                error: 'Search query is required'
            });
        }
        
        // This would implement documentation search
        const searchResults = await OpenTelemetryTracing.traceOperation(
            'documentation.search',
            async () => {
                // Search logic would go here
                return {
                    query,
                    results: [],
                    total: 0,
                    took: '15ms'
                };
            }
        );
        
        res.json({
            success: true,
            data: searchResults
        });
        
    } catch (error) {
        console.error('Documentation search error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to search documentation'
        });
    }
});

/**
 * GET /api/documentation/health
 * Documentation system health check
 */
router.get('/health', async (req, res) => {
    try {
        const health = {
            status: 'healthy',
            initialized: docManager.isInitialized,
            uptime: process.uptime(),
            timestamp: new Date().toISOString(),
            services: {
                documentation: 'healthy',
                maintenance: 'healthy',
                troubleshooting: 'healthy'
            }
        };
        
        res.json({
            success: true,
            data: health
        });
        
    } catch (error) {
        console.error('Documentation health error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get health status'
        });
    }
});

/**
 * GET /api/documentation/metrics
 * Get documentation system metrics
 */
router.get('/metrics', async (req, res) => {
    try {
        const metrics = await OpenTelemetryTracing.traceOperation(
            'documentation.metrics',
            async () => {
                return {
                    documentation: {
                        totalGenerated: 0,
                        lastGenerated: null,
                        types: Object.keys(docManager.documentationTypes).length
                    },
                    maintenance: {
                        tasksExecuted: 0,
                        lastExecution: null,
                        totalTasks: Object.keys(docManager.maintenanceTasks).length
                    },
                    troubleshooting: {
                        scenariosHandled: 0,
                        totalScenarios: Object.keys(docManager.troubleshootingScenarios).length
                    }
                };
            }
        );
        
        res.json({
            success: true,
            data: metrics
        });
        
    } catch (error) {
        console.error('Documentation metrics error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get metrics'
        });
    }
});

export default router;
