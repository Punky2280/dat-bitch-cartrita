// PHASE_A_WORKFLOW_IMPLEMENTATION: Connector Registry Service
// Manages external service integrations for workflow automation platform
// Handles connector discovery, authentication, and capability management

import { Pool } from 'pg';
import { traceOperation } from '../system/OpenTelemetryTracing.js';

/**
 * Service for managing workflow connectors and external integrations
 */
class ConnectorRegistryService {
  constructor() {
    this.db = null;
    this.connectorCache = new Map(); // connector_name -> connector config
    this.isInitialized = false;
  }

  async initialize(dbPool) {
    return traceOperation('connector.registry.initialize', async () => {
      try {
        this.db = dbPool;
        await this.loadConnectors();
        this.isInitialized = true;
        console.log('[CONNECTOR_REGISTRY] Service initialized successfully');
        return { success: true };
      } catch (error) {
        console.error('[CONNECTOR_REGISTRY] Initialization failed:', error);
        throw error;
      }
    });
  }

  /**
   * Load all active connectors into cache
   * @private
   */
  async loadConnectors() {
    const result = await this.db.query(`
      SELECT * FROM workflow_connectors 
      WHERE is_enabled = true 
      ORDER BY name
    `);

    this.connectorCache.clear();
    result.rows.forEach(connector => {
      this.connectorCache.set(connector.name, connector);
    });

    console.log(`[CONNECTOR_REGISTRY] Loaded ${result.rows.length} connectors`);
  }

  /**
   * Get all available connectors
   */
  async getConnectors(category = null) {
    if (!this.isInitialized) {
      throw new Error('ConnectorRegistryService not initialized');
    }

    return traceOperation('connector.registry.get_connectors', async (span) => {
      let query = 'SELECT * FROM workflow_connectors WHERE is_enabled = true';
      const params = [];

      if (category) {
        query += ' AND category = $1';
        params.push(category);
        span.setAttribute('connector.category', category);
      }

      query += ' ORDER BY display_name';

      const result = await this.db.query(query, params);
      
      span.setAttributes({
        'connector.count': result.rows.length,
        'connector.cached': this.connectorCache.size
      });

      return {
        success: true,
        data: result.rows,
        count: result.rows.length
      };
    });
  }

  /**
   * Get connector by name
   */
  async getConnector(connectorName) {
    if (!this.isInitialized) {
      throw new Error('ConnectorRegistryService not initialized');
    }

    return traceOperation('connector.registry.get_connector', async (span) => {
      span.setAttribute('connector.name', connectorName);

      // Check cache first
      if (this.connectorCache.has(connectorName)) {
        const connector = this.connectorCache.get(connectorName);
        span.setAttribute('connector.from_cache', true);
        return { success: true, data: connector };
      }

      // Fallback to database
      const result = await this.db.query(`
        SELECT * FROM workflow_connectors 
        WHERE name = $1 AND is_enabled = true
      `, [connectorName]);

      if (result.rows.length === 0) {
        span.setAttribute('connector.found', false);
        throw new Error(`Connector not found: ${connectorName}`);
      }

      const connector = result.rows[0];
      
      // Update cache
      this.connectorCache.set(connectorName, connector);
      
      span.setAttributes({
        'connector.found': true,
        'connector.from_cache': false,
        'connector.category': connector.category
      });

      return { success: true, data: connector };
    });
  }

  /**
   * Register new connector
   */
  async registerConnector(connectorData) {
    if (!this.isInitialized) {
      throw new Error('ConnectorRegistryService not initialized');
    }

    return traceOperation('connector.registry.register', async (span) => {
      try {
        const {
          name, display_name, description, category, icon, version = '1.0.0',
          auth_type = 'none', auth_schema = {}, base_url, default_headers = {},
          rate_limit_config = {}, supported_operations = [], webhook_support = false,
          polling_support = false, is_builtin = false
        } = connectorData;

        const result = await this.db.query(`
          INSERT INTO workflow_connectors (
            name, display_name, description, category, icon, version,
            auth_type, auth_schema, base_url, default_headers,
            rate_limit_config, supported_operations, webhook_support,
            polling_support, is_builtin, is_enabled
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, true)
          RETURNING *
        `, [
          name, display_name, description, category, icon, version,
          auth_type, JSON.stringify(auth_schema), base_url, JSON.stringify(default_headers),
          JSON.stringify(rate_limit_config), supported_operations, webhook_support,
          polling_support, is_builtin
        ]);

        const newConnector = result.rows[0];
        
        // Update cache
        this.connectorCache.set(name, newConnector);

        span.setAttributes({
          'connector.name': name,
          'connector.category': category,
          'connector.auth_type': auth_type,
          'connector.operations_count': supported_operations.length
        });

        console.log(`[CONNECTOR_REGISTRY] Registered connector: ${name}`);
        
        return { success: true, data: newConnector };

      } catch (error) {
        if (error.code === '23505') { // Unique constraint violation
          throw new Error(`Connector already exists: ${connectorData.name}`);
        }
        throw error;
      }
    });
  }

  /**
   * Update existing connector
   */
  async updateConnector(connectorName, updateData) {
    if (!this.isInitialized) {
      throw new Error('ConnectorRegistryService not initialized');
    }

    return traceOperation('connector.registry.update', async (span) => {
      const allowedFields = [
        'display_name', 'description', 'icon', 'version', 'auth_schema',
        'base_url', 'default_headers', 'rate_limit_config', 'supported_operations',
        'webhook_support', 'polling_support', 'is_enabled'
      ];

      const updates = [];
      const values = [];
      let paramIndex = 1;

      for (const [key, value] of Object.entries(updateData)) {
        if (allowedFields.includes(key)) {
          updates.push(`${key} = $${paramIndex}`);
          values.push(typeof value === 'object' ? JSON.stringify(value) : value);
          paramIndex++;
        }
      }

      if (updates.length === 0) {
        throw new Error('No valid fields to update');
      }

      values.push(connectorName);

      const result = await this.db.query(`
        UPDATE workflow_connectors 
        SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
        WHERE name = $${paramIndex}
        RETURNING *
      `, values);

      if (result.rows.length === 0) {
        throw new Error(`Connector not found: ${connectorName}`);
      }

      const updatedConnector = result.rows[0];
      
      // Update cache
      this.connectorCache.set(connectorName, updatedConnector);

      span.setAttributes({
        'connector.name': connectorName,
        'connector.fields_updated': updates.length
      });

      console.log(`[CONNECTOR_REGISTRY] Updated connector: ${connectorName}`);
      
      return { success: true, data: updatedConnector };
    });
  }

  /**
   * Test connector connectivity and authentication
   */
  async testConnector(connectorName, authData = {}) {
    if (!this.isInitialized) {
      throw new Error('ConnectorRegistryService not initialized');
    }

    return traceOperation('connector.registry.test', async (span) => {
      const connectorResult = await this.getConnector(connectorName);
      const connector = connectorResult.data;

      span.setAttributes({
        'connector.name': connectorName,
        'connector.auth_type': connector.auth_type
      });

      // TODO: PHASE_A_IMPLEMENTATION - Add actual connectivity testing
      // For now, return mock test result
      await new Promise(resolve => setTimeout(resolve, 500)); // Simulate test

      const testResult = {
        connector: connectorName,
        status: 'success',
        message: 'Connector test successful',
        tested_at: new Date().toISOString(),
        capabilities: connector.supported_operations,
        latency_ms: 500
      };

      console.log(`[CONNECTOR_REGISTRY] Test result for ${connectorName}:`, testResult.status);

      return { success: true, data: testResult };
    });
  }

  /**
   * Get connector capabilities and supported operations
   */
  async getConnectorCapabilities(connectorName) {
    if (!this.isInitialized) {
      throw new Error('ConnectorRegistryService not initialized');
    }

    const connectorResult = await this.getConnector(connectorName);
    const connector = connectorResult.data;

    return {
      success: true,
      data: {
        name: connector.name,
        display_name: connector.display_name,
        category: connector.category,
        auth_type: connector.auth_type,
        supported_operations: connector.supported_operations,
        webhook_support: connector.webhook_support,
        polling_support: connector.polling_support,
        rate_limit_config: connector.rate_limit_config,
        version: connector.version
      }
    };
  }

  /**
   * Search connectors by category, operation, or keyword
   */
  async searchConnectors(searchTerm, filters = {}) {
    if (!this.isInitialized) {
      throw new Error('ConnectorRegistryService not initialized');
    }

    return traceOperation('connector.registry.search', async (span) => {
      let query = `
        SELECT * FROM workflow_connectors 
        WHERE is_enabled = true
      `;
      const params = [];
      let paramIndex = 1;

      if (searchTerm) {
        query += ` AND (
          name ILIKE $${paramIndex} OR 
          display_name ILIKE $${paramIndex} OR 
          description ILIKE $${paramIndex}
        )`;
        params.push(`%${searchTerm}%`);
        paramIndex++;
      }

      if (filters.category) {
        query += ` AND category = $${paramIndex}`;
        params.push(filters.category);
        paramIndex++;
      }

      if (filters.auth_type) {
        query += ` AND auth_type = $${paramIndex}`;
        params.push(filters.auth_type);
        paramIndex++;
      }

      if (filters.supports_webhooks) {
        query += ` AND webhook_support = $${paramIndex}`;
        params.push(filters.supports_webhooks);
        paramIndex++;
      }

      query += ' ORDER BY display_name';

      const result = await this.db.query(query, params);

      span.setAttributes({
        'search.term': searchTerm || '',
        'search.filters_count': Object.keys(filters).length,
        'search.results_count': result.rows.length
      });

      return {
        success: true,
        data: result.rows,
        count: result.rows.length,
        search_term: searchTerm,
        filters_applied: filters
      };
    });
  }

  /**
   * Get connector statistics and usage metrics
   */
  async getConnectorStats() {
    if (!this.isInitialized) {
      throw new Error('ConnectorRegistryService not initialized');
    }

    return traceOperation('connector.registry.stats', async () => {
      const statsResult = await this.db.query(`
        SELECT 
          category,
          COUNT(*) as count,
          COUNT(*) FILTER (WHERE is_enabled = true) as enabled_count,
          COUNT(*) FILTER (WHERE webhook_support = true) as webhook_count,
          COUNT(*) FILTER (WHERE polling_support = true) as polling_count
        FROM workflow_connectors 
        GROUP BY category
        ORDER BY count DESC
      `);

      const totalResult = await this.db.query(`
        SELECT 
          COUNT(*) as total_connectors,
          COUNT(*) FILTER (WHERE is_enabled = true) as active_connectors,
          COUNT(DISTINCT category) as categories_count
        FROM workflow_connectors
      `);

      return {
        success: true,
        data: {
          total: totalResult.rows[0],
          by_category: statsResult.rows,
          cache_size: this.connectorCache.size
        }
      };
    });
  }
}

export default ConnectorRegistryService;