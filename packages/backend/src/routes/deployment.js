/**
 * Production Deployment API Routes
 * REST API endpoints for deployment pipeline management
 * August 16, 2025
 */

import { Router } from 'express';
import OpenTelemetryTracing from '../system/OpenTelemetryTracing.js';
import ProductionDeploymentPipelineManager from '../services/ProductionDeploymentPipelineManager.js';
import InfrastructureAsCodeManager from '../services/InfrastructureAsCodeManager.js';

const router = Router();

// Initialize services
const deploymentManager = new ProductionDeploymentPipelineManager();
const infrastructureManager = new InfrastructureAsCodeManager();

/**
 * Get deployment pipeline status
 * GET /api/deployment/status
 */
router.get('/status', async (req, res) => {
    const span = OpenTelemetryTracing.traceOperation('api.deployment.status');
    
    try {
        const deploymentStatus = deploymentManager.getDeploymentStatus();
        const infrastructureStatus = infrastructureManager.getInfrastructureStatus();
        
        res.json({
            success: true,
            data: {
                deployment: deploymentStatus,
                infrastructure: infrastructureStatus,
                timestamp: new Date().toISOString()
            }
        });
        
        span.setAttributes({
            'status.deployment_initialized': deploymentStatus.isInitialized,
            'status.infrastructure_initialized': infrastructureStatus.isInitialized,
            'status.active_deployments': deploymentStatus.activeDeployments?.length || 0
        });
        
    } catch (error) {
        span.recordException(error);
        console.error('❌ Failed to get deployment status:', error);
        
        res.status(500).json({
            success: false,
            error: 'Failed to get deployment status',
            details: error.message
        });
        
    } finally {
        span.end();
    }
});

/**
 * Get deployment metrics
 * GET /api/deployment/metrics
 */
router.get('/metrics', async (req, res) => {
    const span = OpenTelemetryTracing.traceOperation('api.deployment.metrics');
    
    try {
        const deploymentMetrics = deploymentManager.getDeploymentMetrics();
        const infrastructureMetrics = infrastructureManager.getInfrastructureMetrics();
        
        res.json({
            success: true,
            data: {
                deployment: deploymentMetrics,
                infrastructure: infrastructureMetrics,
                timestamp: new Date().toISOString()
            }
        });
        
        span.setAttributes({
            'metrics.total_deployments': deploymentMetrics.totalDeployments,
            'metrics.successful_deployments': deploymentMetrics.successfulDeployments,
            'metrics.failed_deployments': deploymentMetrics.failedDeployments,
            'metrics.active_deployments': deploymentMetrics.activeDeployments
        });
        
    } catch (error) {
        span.recordException(error);
        console.error('❌ Failed to get deployment metrics:', error);
        
        res.status(500).json({
            success: false,
            error: 'Failed to get deployment metrics',
            details: error.message
        });
        
    } finally {
        span.end();
    }
});

/**
 * Deploy to environment
 * POST /api/deployment/deploy
 * Body: { environment, image, branch, commit, strategy, approvedBy }
 */
router.post('/deploy', async (req, res) => {
    const span = OpenTelemetryTracing.traceOperation('api.deployment.deploy');
    
    try {
        const {
            environment,
            image,
            branch,
            commit,
            strategy,
            approvedBy
        } = req.body;
        
        // Validation
        if (!environment) {
            return res.status(400).json({
                success: false,
                error: 'Environment is required'
            });
        }
        
        if (!image) {
            return res.status(400).json({
                success: false,
                error: 'Docker image is required'
            });
        }
        
        const deployment = await deploymentManager.deployToEnvironment(environment, {
            image,
            branch,
            commit,
            strategy,
            approvedBy
        });
        
        res.status(202).json({
            success: true,
            data: {
                deploymentId: deployment.id,
                environment: deployment.environment,
                state: deployment.state,
                strategy: deployment.strategy,
                startTime: deployment.startTime
            },
            message: 'Deployment started successfully'
        });
        
        span.setAttributes({
            'deployment.id': deployment.id,
            'deployment.environment': deployment.environment,
            'deployment.strategy': deployment.strategy,
            'deployment.image': image,
            'deployment.branch': branch || 'unknown'
        });
        
    } catch (error) {
        span.recordException(error);
        console.error('❌ Failed to start deployment:', error);
        
        res.status(500).json({
            success: false,
            error: 'Failed to start deployment',
            details: error.message
        });
        
    } finally {
        span.end();
    }
});

/**
 * Get deployment details
 * GET /api/deployment/:deploymentId
 */
router.get('/:deploymentId', async (req, res) => {
    const span = OpenTelemetryTracing.traceOperation('api.deployment.get_details');
    
    try {
        const { deploymentId } = req.params;
        
        const deployment = deploymentManager.getDeploymentStatus(deploymentId);
        
        if (!deployment) {
            return res.status(404).json({
                success: false,
                error: 'Deployment not found'
            });
        }
        
        res.json({
            success: true,
            data: deployment
        });
        
        span.setAttributes({
            'deployment.id': deploymentId,
            'deployment.state': deployment.state,
            'deployment.environment': deployment.environment
        });
        
    } catch (error) {
        span.recordException(error);
        console.error('❌ Failed to get deployment details:', error);
        
        res.status(500).json({
            success: false,
            error: 'Failed to get deployment details',
            details: error.message
        });
        
    } finally {
        span.end();
    }
});

/**
 * Rollback deployment
 * POST /api/deployment/:deploymentId/rollback
 */
router.post('/:deploymentId/rollback', async (req, res) => {
    const span = OpenTelemetryTracing.traceOperation('api.deployment.rollback');
    
    try {
        const { deploymentId } = req.params;
        const { reason } = req.body;
        
        await deploymentManager.rollbackDeployment(deploymentId, reason);
        
        res.json({
            success: true,
            message: 'Rollback initiated successfully',
            data: {
                deploymentId,
                reason: reason || 'manual_rollback'
            }
        });
        
        span.setAttributes({
            'rollback.deployment_id': deploymentId,
            'rollback.reason': reason || 'manual_rollback'
        });
        
    } catch (error) {
        span.recordException(error);
        console.error('❌ Failed to rollback deployment:', error);
        
        res.status(500).json({
            success: false,
            error: 'Failed to rollback deployment',
            details: error.message
        });
        
    } finally {
        span.end();
    }
});

/**
 * List environments
 * GET /api/deployment/environments
 */
router.get('/environments/list', async (req, res) => {
    const span = OpenTelemetryTracing.traceOperation('api.deployment.list_environments');
    
    try {
        const environments = Array.from(deploymentManager.environments.entries()).map(([name, config]) => ({
            name,
            replicas: config.config.replicas,
            domain: config.config.domain,
            autoApprove: config.config.autoApprove,
            healthCheck: config.config.healthCheck,
            strategy: config.config.strategy
        }));
        
        res.json({
            success: true,
            data: {
                environments,
                count: environments.length
            }
        });
        
        span.setAttributes({
            'environments.count': environments.length
        });
        
    } catch (error) {
        span.recordException(error);
        console.error('❌ Failed to list environments:', error);
        
        res.status(500).json({
            success: false,
            error: 'Failed to list environments',
            details: error.message
        });
        
    } finally {
        span.end();
    }
});

/**
 * Get deployment history
 * GET /api/deployment/history
 */
router.get('/history/list', async (req, res) => {
    const span = OpenTelemetryTracing.traceOperation('api.deployment.get_history');
    
    try {
        const { limit = 50, offset = 0, environment, state } = req.query;
        
        let deployments = Array.from(deploymentManager.deployments.values());
        
        // Filter by environment if specified
        if (environment) {
            deployments = deployments.filter(dep => dep.environment === environment);
        }
        
        // Filter by state if specified
        if (state) {
            deployments = deployments.filter(dep => dep.state === state);
        }
        
        // Sort by start time (most recent first)
        deployments = deployments.sort((a, b) => b.startTime - a.startTime);
        
        // Apply pagination
        const total = deployments.length;
        const paginatedDeployments = deployments.slice(
            parseInt(offset), 
            parseInt(offset) + parseInt(limit)
        );
        
        res.json({
            success: true,
            data: {
                deployments: paginatedDeployments,
                pagination: {
                    total,
                    limit: parseInt(limit),
                    offset: parseInt(offset),
                    hasMore: parseInt(offset) + parseInt(limit) < total
                }
            }
        });
        
        span.setAttributes({
            'history.total_deployments': total,
            'history.returned_deployments': paginatedDeployments.length,
            'history.environment_filter': environment || 'none',
            'history.state_filter': state || 'none'
        });
        
    } catch (error) {
        span.recordException(error);
        console.error('❌ Failed to get deployment history:', error);
        
        res.status(500).json({
            success: false,
            error: 'Failed to get deployment history',
            details: error.message
        });
        
    } finally {
        span.end();
    }
});

/**
 * Approve pending deployment
 * POST /api/deployment/:deploymentId/approve
 */
router.post('/:deploymentId/approve', async (req, res) => {
    const span = OpenTelemetryTracing.traceOperation('api.deployment.approve');
    
    try {
        const { deploymentId } = req.params;
        const { approvedBy, comments } = req.body;
        
        const deployment = deploymentManager.deployments.get(deploymentId);
        
        if (!deployment) {
            return res.status(404).json({
                success: false,
                error: 'Deployment not found'
            });
        }
        
        if (deployment.state !== 'pending') {
            return res.status(400).json({
                success: false,
                error: 'Deployment is not pending approval'
            });
        }
        
        // Continue deployment with approval
        deployment.approvedBy = approvedBy;
        deployment.approvalComments = comments;
        
        // Re-trigger deployment
        const updatedDeployment = await deploymentManager.deployToEnvironment(
            deployment.environment, 
            {
                ...deployment,
                approvedBy
            }
        );
        
        res.json({
            success: true,
            message: 'Deployment approved and continued',
            data: {
                deploymentId,
                approvedBy,
                state: updatedDeployment.state
            }
        });
        
        span.setAttributes({
            'approval.deployment_id': deploymentId,
            'approval.approved_by': approvedBy || 'anonymous'
        });
        
    } catch (error) {
        span.recordException(error);
        console.error('❌ Failed to approve deployment:', error);
        
        res.status(500).json({
            success: false,
            error: 'Failed to approve deployment',
            details: error.message
        });
        
    } finally {
        span.end();
    }
});

/**
 * Cancel deployment
 * POST /api/deployment/:deploymentId/cancel
 */
router.post('/:deploymentId/cancel', async (req, res) => {
    const span = OpenTelemetryTracing.traceOperation('api.deployment.cancel');
    
    try {
        const { deploymentId } = req.params;
        const { reason } = req.body;
        
        const deployment = deploymentManager.deployments.get(deploymentId);
        
        if (!deployment) {
            return res.status(404).json({
                success: false,
                error: 'Deployment not found'
            });
        }
        
        if (deployment.state !== 'pending' && deployment.state !== 'running') {
            return res.status(400).json({
                success: false,
                error: 'Deployment cannot be cancelled in current state'
            });
        }
        
        deployment.state = 'cancelled';
        deployment.endTime = Date.now();
        deployment.duration = deployment.endTime - deployment.startTime;
        deployment.cancellationReason = reason || 'manual_cancellation';
        
        res.json({
            success: true,
            message: 'Deployment cancelled successfully',
            data: {
                deploymentId,
                state: deployment.state,
                reason: deployment.cancellationReason
            }
        });
        
        span.setAttributes({
            'cancellation.deployment_id': deploymentId,
            'cancellation.reason': reason || 'manual_cancellation'
        });
        
    } catch (error) {
        span.recordException(error);
        console.error('❌ Failed to cancel deployment:', error);
        
        res.status(500).json({
            success: false,
            error: 'Failed to cancel deployment',
            details: error.message
        });
        
    } finally {
        span.end();
    }
});

/**
 * Get infrastructure templates
 * GET /api/deployment/infrastructure/templates
 */
router.get('/infrastructure/templates', async (req, res) => {
    const span = OpenTelemetryTracing.traceOperation('api.deployment.get_infrastructure_templates');
    
    try {
        const { provider, resourceType } = req.query;
        
        let templates = Array.from(infrastructureManager.templates.values());
        
        // Filter by provider if specified
        if (provider) {
            templates = templates.filter(template => template.provider === provider);
        }
        
        // Filter by resource type if specified
        if (resourceType) {
            templates = templates.filter(template => template.resourceType === resourceType);
        }
        
        res.json({
            success: true,
            data: {
                templates: templates.map(template => ({
                    name: template.name,
                    provider: template.provider,
                    resourceType: template.resourceType
                })),
                count: templates.length
            }
        });
        
        span.setAttributes({
            'templates.total': templates.length,
            'templates.provider_filter': provider || 'none',
            'templates.resource_type_filter': resourceType || 'none'
        });
        
    } catch (error) {
        span.recordException(error);
        console.error('❌ Failed to get infrastructure templates:', error);
        
        res.status(500).json({
            success: false,
            error: 'Failed to get infrastructure templates',
            details: error.message
        });
        
    } finally {
        span.end();
    }
});

/**
 * Health check endpoint
 * GET /api/deployment/health
 */
router.get('/health', async (req, res) => {
    const span = OpenTelemetryTracing.traceOperation('api.deployment.health');
    
    try {
        const deploymentHealth = {
            initialized: deploymentManager.isInitialized,
            activeDeployments: deploymentManager.metrics.activeDeployments,
            healthStatus: deploymentManager.isInitialized ? 'healthy' : 'unhealthy'
        };
        
        const infrastructureHealth = {
            initialized: infrastructureManager.isInitialized,
            providersAvailable: Array.from(infrastructureManager.providers.values())
                .filter(p => p.initialized).length,
            healthStatus: infrastructureManager.isInitialized ? 'healthy' : 'unhealthy'
        };
        
        const overallHealth = deploymentHealth.healthStatus === 'healthy' && 
                             infrastructureHealth.healthStatus === 'healthy' ? 'healthy' : 'unhealthy';
        
        res.json({
            success: true,
            data: {
                status: overallHealth,
                deployment: deploymentHealth,
                infrastructure: infrastructureHealth,
                timestamp: new Date().toISOString()
            }
        });
        
        span.setAttributes({
            'health.deployment': deploymentHealth.healthStatus,
            'health.infrastructure': infrastructureHealth.healthStatus,
            'health.overall': overallHealth
        });
        
    } catch (error) {
        span.recordException(error);
        console.error('❌ Health check failed:', error);
        
        res.status(500).json({
            success: false,
            error: 'Health check failed',
            details: error.message
        });
        
    } finally {
        span.end();
    }
});

export default router;
