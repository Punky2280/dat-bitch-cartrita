/**
 * @fileoverview MCP Integration for Existing Backend
 * Integrates the new MCP system with the existing Cartrita backend
 * Utilizes Redis, PostgreSQL with pgvector, OpenTelemetry, and ES6 modules
 */

import { createRequire } from 'module';
import { trace } from '@opentelemetry/api';

const require = createRequire(import.meta.url);

console.log('[MCP Integration] Initializing MCP System...');

/**
 * MCP System Manager - Manages the hierarchical MCP system
 * Integrates with Redis cache, PostgreSQL with pgvector, and OpenTelemetry
 */
export class MCPSystemManager {
  constructor() {
    this.orchestrator = null;
    this.intelligenceSupervisor = null;
    this.multiModalSupervisor = null;
    this.isInitialized = false;
    this.logger = console;
    this.tracer = trace.getTracer('mcp-system-manager');
    this.pool = null; // PostgreSQL connection pool
    this.redisClient = null; // Redis client
    this.taskHistory = new Map(); // In-memory task history
  }

  /**
   * Initialize MCP system with existing backend services
   */
  async initialize(existingServices = {}, dbPool = null, redisClient = null) {
    if (this.isInitialized) return;

    const span = this.tracer.startSpan('mcp.system.initialize');

    try {
      this.logger.log('[MCP] Initializing Master Control Program with full infrastructure...');

      // Store database and Redis connections
      this.pool = dbPool;
      this.redisClient = redisClient;

      // Initialize database schema for MCP
      await this.initializeMCPSchema();

      // Initialize Redis cache for MCP
      await this.initializeMCPCache();

      // Create enhanced MCP system that utilizes existing infrastructure
      await this.initializeEnhancedMCP(existingServices);

      this.isInitialized = true;
      span.setAttributes({ 'mcp.initialized': true });
      this.logger.log('[MCP] Master Control Program initialized successfully');
    } catch (error) {
      span.recordException(error);
      this.logger.error('[MCP] Failed to initialize MCP system:', error);
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Initialize MCP database schema
   */
  async initializeMCPSchema() {
    if (!this.pool) {
      this.logger.warn('[MCP] No database pool provided, skipping schema initialization');
      return;
    }

    try {
      // Create MCP tasks table with pgvector support
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS mcp_tasks (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          task_type VARCHAR(255) NOT NULL,
          status VARCHAR(50) NOT NULL DEFAULT 'pending',
          parameters JSONB,
          result JSONB,
          error_message TEXT,
          metadata JSONB,
          embedding VECTOR(1536), -- OpenAI embedding size
          user_id INTEGER REFERENCES users(id),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `);

      // Create indexes for efficient querying
      await this.pool.query(`
        CREATE INDEX IF NOT EXISTS idx_mcp_tasks_type ON mcp_tasks(task_type);
        CREATE INDEX IF NOT EXISTS idx_mcp_tasks_status ON mcp_tasks(status);
        CREATE INDEX IF NOT EXISTS idx_mcp_tasks_user ON mcp_tasks(user_id);
        CREATE INDEX IF NOT EXISTS idx_mcp_tasks_created ON mcp_tasks(created_at);
      `);

      // Create embedding similarity index if pgvector is available
      try {
        await this.pool.query(`
          CREATE INDEX IF NOT EXISTS idx_mcp_tasks_embedding 
          ON mcp_tasks USING ivfflat (embedding vector_cosine_ops) 
          WITH (lists = 100);
        `);
      } catch (embeddingError) {
        this.logger.warn('[MCP] pgvector extension not available, skipping embedding index');
      }

      this.logger.log('[MCP] Database schema initialized successfully');
    } catch (error) {
      this.logger.error('[MCP] Failed to initialize database schema:', error);
      throw error;
    }
  }

  /**
   * Initialize MCP Redis cache
   */
  async initializeMCPCache() {
    if (!this.redisClient) {
      this.logger.warn('[MCP] No Redis client provided, using in-memory cache');
      return;
    }

    try {
      // Test Redis connection
      await this.redisClient.ping();
      
      // Set up MCP cache keys
      await this.redisClient.hSet('mcp:stats', {
        'tasks_processed': '0',
        'errors_count': '0',
        'last_restart': new Date().toISOString()
      });

      this.logger.log('[MCP] Redis cache initialized successfully');
    } catch (error) {
      this.logger.error('[MCP] Failed to initialize Redis cache:', error);
      throw error;
    }
  }

  /**
   * Initialize enhanced MCP system
   */
  async initializeEnhancedMCP(existingServices) {
    // Create a minimal MCP orchestrator that works with existing routes
    this.orchestrator = {
      name: 'MCP-Orchestrator',
      status: 'active',
      async handleTask(taskType, parameters) {
        // Route tasks to existing services based on type
        switch (taskType) {
          case 'research.web.search':
          case 'research.github.search':
            if (existingServices.researcherAgent) {
              return await existingServices.researcherAgent.processTask(parameters);
            }
            break;
          
          case 'writer.content.create':
          case 'writer.blog.post':
            if (existingServices.writerAgent) {
              return await existingServices.writerAgent.generateContent(parameters);
            }
            break;
          
          case 'codewriter.generate.function':
          case 'codewriter.refactor.code':
            if (existingServices.codeWriterAgent) {
              return await existingServices.codeWriterAgent.generateCode(parameters);
            }
            break;
          
          case 'analytics.data.query':
          case 'analytics.report.generate':
            if (existingServices.analyticsAgent) {
              return await existingServices.analyticsAgent.processData(parameters);
            }
            break;
          
          case 'multimodal.vision.analyze':
          case 'multimodal.audio.transcribe':
            if (existingServices.multiModalFusionAgent) {
              return await existingServices.multiModalFusionAgent.processMultiModal(parameters);
            }
            break;
          
          default:
            // Try to route to the core agent as fallback
            if (existingServices.coreAgent) {
              return await existingServices.coreAgent.processRequest(parameters);
            }
            throw new Error(`Unsupported task type: ${taskType}`);
        }
      }
    };

    // Create intelligence supervisor that wraps existing consciousness agents
    this.intelligenceSupervisor = {
      name: 'Intelligence-Supervisor',
      status: 'active',
      supportedTasks: [
        'research.web.search',
        'research.github.search', 
        'writer.content.create',
        'writer.blog.post',
        'codewriter.generate.function',
        'codewriter.refactor.code',
        'analytics.data.query',
        'analytics.report.generate',
        'langchain.agent.execute'
      ],
      getStats() {
        return {
          activeAgents: Object.keys(existingServices).filter(key => key.endsWith('Agent')).length,
          supportedTaskTypes: this.supportedTasks.length,
          status: this.status
        };
      }
    };

    // Create multimodal supervisor that wraps existing multimodal agents  
    this.multiModalSupervisor = {
      name: 'MultiModal-Supervisor',
      status: 'active',
      supportedTasks: [
        'multimodal.vision.analyze',
        'multimodal.audio.transcribe',
        'multimodal.fuse',
        'deepgram.audio.transcribe.live',
        'artist.generate_image'
      ],
      getStats() {
        return {
          multiModalCapabilities: ['vision', 'audio', 'sensor_fusion'],
          supportedTaskTypes: this.supportedTasks.length,
          status: this.status
        };
      }
    };

    this.logger.log('[MCP] MCP supervisors initialized');
  }

  /**
   * Process task through MCP system
   */
  async processTask(taskType, parameters, context = {}) {
    if (!this.isInitialized) {
      throw new Error('MCP system not initialized');
    }

    try {
      // Route through orchestrator
      const result = await this.orchestrator.handleTask(taskType, parameters);
      
      return {
        taskType,
        status: 'completed',
        result,
        processedBy: 'MCP-System',
        metadata: {
          timestamp: new Date().toISOString(),
          orchestrator: this.orchestrator.name,
          context
        }
      };
    } catch (error) {
      this.logger.error(`[MCP] Task processing failed:`, error);
      return {
        taskType,
        status: 'failed',
        error: error.message,
        processedBy: 'MCP-System',
        metadata: {
          timestamp: new Date().toISOString(),
          context
        }
      };
    }
  }

  /**
   * Get MCP system status
   */
  getStatus() {
    return {
      initialized: this.isInitialized,
      orchestrator: this.orchestrator?.status || 'inactive',
      supervisors: {
        intelligence: this.intelligenceSupervisor?.getStats() || { status: 'inactive' },
        multimodal: this.multiModalSupervisor?.getStats() || { status: 'inactive' }
      },
      supportedTaskTypes: [
        ...this.intelligenceSupervisor?.supportedTasks || [],
        ...this.multiModalSupervisor?.supportedTasks || []
      ]
    };
  }

  /**
   * Add MCP routes to existing Express app
   */
  addMCPRoutes(app) {
    // Add MCP status route
    app.get('/api/mcp/status', (req, res) => {
      res.json(this.getStatus());
    });

    // Add MCP task processing route
    app.post('/api/mcp/task', async (req, res) => {
      try {
        const { taskType, parameters } = req.body;
        
        if (!taskType) {
          return res.status(400).json({ error: 'taskType is required' });
        }

        const result = await this.processTask(taskType, parameters, {
          userId: req.user?.id,
          sessionId: req.sessionID
        });
        
        res.json(result);
      } catch (error) {
        this.logger.error('[MCP API] Task processing error:', error);
        res.status(500).json({ 
          error: 'Task processing failed',
          details: error.message 
        });
      }
    });

    // Add MCP health check route
    app.get('/api/mcp/health', (req, res) => {
      const status = this.getStatus();
      const isHealthy = status.initialized && status.orchestrator === 'active';
      
      res.status(isHealthy ? 200 : 503).json({
        status: isHealthy ? 'healthy' : 'unhealthy',
        ...status
      });
    });

    this.logger.log('[MCP] MCP routes added to Express app');
  }

  /**
   * Shutdown MCP system
   */
  async shutdown() {
    if (!this.isInitialized) return;

    try {
      this.logger.log('[MCP] Shutting down MCP system...');

      if (this.orchestrator) {
        this.orchestrator.status = 'inactive';
      }
      
      if (this.intelligenceSupervisor) {
        this.intelligenceSupervisor.status = 'inactive';
      }
      
      if (this.multiModalSupervisor) {
        this.multiModalSupervisor.status = 'inactive';
      }

      this.isInitialized = false;
      this.logger.log('[MCP] MCP system shutdown complete');
    } catch (error) {
      this.logger.error('[MCP] Error during shutdown:', error);
    }
  }
}

// Export singleton instance
export const mcpSystem = new MCPSystemManager();

export default mcpSystem;