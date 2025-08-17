// PHASE_A_WORKFLOW_IMPLEMENTATION: Workflow Services Initialization
// Initializes and wires up the workflow automation platform services
// Handles service dependency injection and graceful startup/shutdown

import WorkflowRunnerService from './WorkflowRunnerService.js';
import ConnectorRegistryService from './ConnectorRegistryService.js';
import ExpressionEngine from './ExpressionEngine.js';
import { traceOperation } from '../system/OpenTelemetryTracing.js';

/**
 * Workflow Automation Platform Services Manager
 * Handles initialization and lifecycle of all workflow services
 */
class WorkflowServices {
  constructor() {
    this.workflowRunnerService = null;
    this.connectorRegistryService = null;
    this.expressionEngine = null;
    this.isInitialized = false;
  }

  /**
   * Initialize all workflow services
   */
  async initialize(dbPool) {
    return traceOperation('workflow.services.initialize', async (span) => {
      try {
        console.log('[WORKFLOW_SERVICES] Initializing workflow automation platform services...');

        // Initialize expression engine first (no dependencies)
        this.expressionEngine = new ExpressionEngine();
        await this.expressionEngine.initialize();
        console.log('[WORKFLOW_SERVICES] ✅ Expression engine initialized');

        // Initialize connector registry service (needs database)
        this.connectorRegistryService = new ConnectorRegistryService();
        await this.connectorRegistryService.initialize(dbPool);
        console.log('[WORKFLOW_SERVICES] ✅ Connector registry service initialized');

        // Initialize workflow runner service (needs database and may use other services)
        this.workflowRunnerService = new WorkflowRunnerService();
        await this.workflowRunnerService.initialize(dbPool);
        console.log('[WORKFLOW_SERVICES] ✅ Workflow runner service initialized');

        this.isInitialized = true;

        span.setAttributes({
          'workflow.services.initialized': true,
          'workflow.services.count': 3
        });

        console.log('[WORKFLOW_SERVICES] All workflow services initialized successfully');
        
        return {
          success: true,
          services: {
            workflowRunnerService: this.workflowRunnerService,
            connectorRegistryService: this.connectorRegistryService,
            expressionEngine: this.expressionEngine
          }
        };

      } catch (error) {
        console.error('[WORKFLOW_SERVICES] Failed to initialize workflow services:', error);
        
        span.setAttributes({
          'workflow.services.initialized': false,
          'workflow.services.error': error.message
        });

        // Cleanup any partially initialized services
        await this.cleanup();
        
        throw new Error(`Workflow services initialization failed: ${error.message}`);
      }
    });
  }

  /**
   * Get all initialized services
   */
  getServices() {
    if (!this.isInitialized) {
      throw new Error('Workflow services not initialized');
    }

    return {
      workflowRunnerService: this.workflowRunnerService,
      connectorRegistryService: this.connectorRegistryService,
      expressionEngine: this.expressionEngine
    };
  }

  /**
   * Get service health status
   */
  async getHealthStatus() {
    if (!this.isInitialized) {
      return {
        status: 'unhealthy',
        error: 'Services not initialized'
      };
    }

    try {
      const services = {
        workflowRunner: this.workflowRunnerService.isInitialized,
        connectorRegistry: this.connectorRegistryService.isInitialized,
        expressionEngine: this.expressionEngine.isInitialized
      };

      const allHealthy = Object.values(services).every(status => status === true);

      return {
        status: allHealthy ? 'healthy' : 'degraded',
        services,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Get service statistics and metrics
   */
  async getServiceStats() {
    if (!this.isInitialized) {
      throw new Error('Workflow services not initialized');
    }

    try {
      // Get connector stats
      const connectorStats = await this.connectorRegistryService.getConnectorStats();
      
      // Get active executions count
      const activeExecutions = this.workflowRunnerService.activeExecutions.size;

      // Get expression engine builtins count
      const expressionBuiltins = this.expressionEngine.getBuiltins();

      return {
        success: true,
        data: {
          connectors: connectorStats.data,
          active_executions: activeExecutions,
          expression_builtins: {
            functions_count: expressionBuiltins.data.functions.length,
            constants_count: expressionBuiltins.data.constants.length,
            categories_count: Object.keys(expressionBuiltins.data.categories).length
          },
          services_initialized: this.isInitialized,
          timestamp: new Date().toISOString()
        }
      };

    } catch (error) {
      console.error('[WORKFLOW_SERVICES] Error getting service stats:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Cleanup all services
   */
  async cleanup() {
    console.log('[WORKFLOW_SERVICES] Cleaning up workflow services...');

    try {
      // Cleanup services in reverse order of initialization
      if (this.workflowRunnerService) {
        // Cancel any active executions
        for (const executionId of this.workflowRunnerService.activeExecutions.keys()) {
          try {
            await this.workflowRunnerService.cancelExecution(executionId);
          } catch (error) {
            console.warn(`[WORKFLOW_SERVICES] Failed to cancel execution ${executionId}:`, error.message);
          }
        }
      }

      // Remove event listeners and cleanup
      if (this.workflowRunnerService) {
        this.workflowRunnerService.removeAllListeners();
      }

      this.isInitialized = false;
      console.log('[WORKFLOW_SERVICES] Cleanup completed');

    } catch (error) {
      console.error('[WORKFLOW_SERVICES] Error during cleanup:', error);
    }
  }

  /**
   * Test all services functionality
   */
  async testServices() {
    if (!this.isInitialized) {
      throw new Error('Workflow services not initialized');
    }

    return traceOperation('workflow.services.test', async (span) => {
      const results = {};

      try {
        // Test expression engine
        const expressionResult = await this.expressionEngine.evaluate('1 + 1');
        results.expressionEngine = {
          success: expressionResult.success && expressionResult.result === 2,
          test: 'basic_arithmetic'
        };

        // Test connector registry
        const connectorsResult = await this.connectorRegistryService.getConnectors();
        results.connectorRegistry = {
          success: connectorsResult.success,
          connectors_count: connectorsResult.data?.length || 0
        };

        // Test workflow runner (check if initialized)
        results.workflowRunner = {
          success: this.workflowRunnerService.isInitialized,
          active_executions: this.workflowRunnerService.activeExecutions.size
        };

        const allSuccessful = Object.values(results).every(r => r.success);

        span.setAttributes({
          'workflow.services.test.success': allSuccessful,
          'workflow.services.test.expression_engine': results.expressionEngine.success,
          'workflow.services.test.connector_registry': results.connectorRegistry.success,
          'workflow.services.test.workflow_runner': results.workflowRunner.success
        });

        return {
          success: allSuccessful,
          results,
          timestamp: new Date().toISOString()
        };

      } catch (error) {
        console.error('[WORKFLOW_SERVICES] Service test failed:', error);
        
        span.setAttribute('workflow.services.test.error', error.message);
        
        return {
          success: false,
          error: error.message,
          results,
          timestamp: new Date().toISOString()
        };
      }
    });
  }
}

// Export singleton instance
const workflowServices = new WorkflowServices();

export default workflowServices;