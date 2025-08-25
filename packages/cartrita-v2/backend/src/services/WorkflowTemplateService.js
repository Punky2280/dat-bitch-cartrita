/**
 * WorkflowTemplateService - Service for managing workflow templates
 * Implements template creation, variable management, instantiation, and usage tracking
 * Based on WORKFLOW_TEMPLATES_SYSTEM_PLAN.md specification
 */

import pool from '../db.js';
// Temporarily disable OpenTelemetry to fix startup issues
// import OpenTelemetryTracing from '../system/OpenTelemetryTracing.js';

const traceOperation = (name, fn) => fn(); // Simple fallback

// Database query helper
const query = async (text, params) => {
  const result = await pool.query(text, params);
  return result;
};

class WorkflowTemplateService {
  constructor() {
    this.initialized = false;
    this.templateCache = new Map(); // Cache frequently accessed templates
  }

  async initialize() {
    try {
      await this._ensureTemplateCategories();
      this.initialized = true;
      console.log('✅ WorkflowTemplateService initialized');
    } catch (error) {
      console.error('❌ Failed to initialize WorkflowTemplateService:', error);
      throw error;
    }
  }

  async _ensureTemplateCategories() {
    const result = await query(
      'SELECT COUNT(*) as count FROM workflow_template_categories'
    );
    if (result.rows[0].count === '0') {
      console.log('Seeding workflow template categories...');
      await this._seedCategories();
    }
  }

  async _seedCategories() {
    const categories = [
      {
        name: 'productivity',
        description: 'Productivity and task management workflows',
        icon: 'productivity',
        sort_order: 1,
      },
      {
        name: 'communication',
        description: 'Email, messaging, and collaboration workflows',
        icon: 'communication',
        sort_order: 2,
      },
      {
        name: 'knowledge',
        description: 'Information processing and knowledge management',
        icon: 'knowledge',
        sort_order: 3,
      },
      {
        name: 'automation',
        description: 'General automation and integration workflows',
        icon: 'automation',
        sort_order: 4,
      },
      {
        name: 'analytics',
        description: 'Data analysis and reporting workflows',
        icon: 'analytics',
        sort_order: 5,
      },
      {
        name: 'personal',
        description: 'Personal life and habit tracking workflows',
        icon: 'personal',
        sort_order: 6,
      },
    ];

    for (const category of categories) {
      await query(
        `
        INSERT INTO workflow_template_categories (name, description, icon, sort_order)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (name) DO NOTHING
      `,
        [
          category.name,
          category.description,
          category.icon,
          category.sort_order,
        ]
      );
    }
  }

  /**
   * Get all template categories
   */
  async getCategories() {
    return traceOperation('workflow.template.getCategories', async span => {
      const result = await query(`
        SELECT id, name, description, icon, sort_order, created_at
        FROM workflow_template_categories
        ORDER BY sort_order, name
      `);

      span?.setAttributes({ 'template.categories.count': result.rows.length });
      return result.rows;
    });
  }

  /**
   * Get templates with optional filtering
   */
  async getTemplates(options = {}) {
    return traceOperation('workflow.template.getTemplates', async span => {
      const {
        category_id,
        user_id,
        include_variables = false,
        limit = 50,
        offset = 0,
      } = options;

      let whereClause = 'WHERE w.is_template = TRUE';
      const params = [];
      let paramCount = 0;

      if (category_id) {
        whereClause += ` AND w.category_id = $${++paramCount}`;
        params.push(category_id);
      }

      if (user_id) {
        whereClause += ` AND w.user_id = $${++paramCount}`;
        params.push(user_id);
      }

      // Simplified query without ratings table for now
      const templateQuery = `
        SELECT 
          w.id, w.name, w.description, w.user_id, w.is_active, w.created_at, w.updated_at,
          w.template_version, w.template_metadata, w.category_id,
          c.name as category_name, c.description as category_description, c.icon as category_icon,
          COUNT(wtu.id) as usage_count
        FROM workflows w
        LEFT JOIN workflow_template_categories c ON w.category_id = c.id
        LEFT JOIN workflow_template_usage wtu ON w.id = wtu.template_id
        ${whereClause}
        GROUP BY w.id, c.id
        ORDER BY w.created_at DESC
        LIMIT $${++paramCount} OFFSET $${++paramCount}
      `;
      params.push(limit, offset);

      const result = await query(templateQuery, params);
      let templates = result.rows;

      // Include variables if requested
      if (include_variables && templates.length > 0) {
        const templateIds = templates.map(t => t.id);
        const variablesQuery = `
          SELECT workflow_id, var_name, description, required, default_value, 
                 var_type, validation_pattern
          FROM workflow_template_variables
          WHERE workflow_id = ANY($1)
          ORDER BY workflow_id, required DESC, var_name
        `;

        const variablesResult = await query(variablesQuery, [templateIds]);
        const variablesByTemplate = {};

        variablesResult.rows.forEach(v => {
          if (!variablesByTemplate[v.workflow_id]) {
            variablesByTemplate[v.workflow_id] = [];
          }
          variablesByTemplate[v.workflow_id].push(v);
        });

        templates = templates.map(template => ({
          ...template,
          variables: variablesByTemplate[template.id] || [],
        }));
      }

      span?.setAttributes({
        'template.count': templates.length,
        'template.include_variables': include_variables,
        'template.category_filter': !!category_id,
      });

      return templates;
    });
  }

  /**
   * Get a single template with all details
   */
  async getTemplate(templateId, userId = null) {
    return traceOperation('workflow.template.getTemplate', async span => {
      // Get template details (simplified without ratings table)
      const templateQuery = `
        SELECT 
          w.id, w.name, w.description, w.user_id, w.is_active, w.created_at, w.updated_at,
          w.template_version, w.template_metadata, w.category_id, w.workflow_data,
          c.name as category_name, c.description as category_description, c.icon as category_icon,
          COUNT(DISTINCT wtu.id) as usage_count
        FROM workflows w
        LEFT JOIN workflow_template_categories c ON w.category_id = c.id
        LEFT JOIN workflow_template_usage wtu ON w.id = wtu.template_id
        WHERE w.id = $1 AND w.is_template = TRUE
        GROUP BY w.id, c.id
      `;

      const templateResult = await query(templateQuery, [templateId]);
      if (templateResult.rows.length === 0) {
        return null;
      }

      const template = templateResult.rows[0];

      // Get template variables
      const variablesQuery = `
        SELECT var_name, description, required, default_value, 
               var_type, validation_pattern, created_at, updated_at
        FROM workflow_template_variables
        WHERE workflow_id = $1
        ORDER BY required DESC, var_name
      `;

      const variablesResult = await query(variablesQuery, [templateId]);
      template.variables = variablesResult.rows;

      span?.setAttributes({
        'template.id': templateId,
        'template.variables.count': template.variables.length,
        'template.usage_count': parseInt(template.usage_count) || 0,
      });

      return template;
    });
  }

  /**
   * Create a new workflow template
   */
  async createTemplate(templateData, userId) {
    return traceOperation('workflow.template.createTemplate', async span => {
      const {
        name,
        description,
        category_id,
        config = {},
        variables = [],
        metadata = {},
      } = templateData;

      try {
        await query('BEGIN');

        // Create workflow as template
        const workflowQuery = `
          INSERT INTO workflows (name, description, user_id, is_active, is_template, 
                                template_version, template_metadata, category_id, workflow_data)
          VALUES ($1, $2, $3, TRUE, TRUE, 1, $4, $5, $6)
          RETURNING id, created_at
        `;

        const workflowResult = await query(workflowQuery, [
          name,
          description,
          userId,
          JSON.stringify(metadata),
          category_id,
          JSON.stringify(config),
        ]);

        const templateId = workflowResult.rows[0].id;

        // Add template variables
        if (variables && variables.length > 0) {
          for (const variable of variables) {
            await query(
              `
              INSERT INTO workflow_template_variables 
                (workflow_id, var_name, description, required, default_value, var_type, validation_pattern)
              VALUES ($1, $2, $3, $4, $5, $6, $7)
            `,
              [
                templateId,
                variable.var_name,
                variable.description || null,
                variable.required !== false,
                variable.default_value || null,
                variable.var_type || 'string',
                variable.validation_pattern || null,
              ]
            );
          }
        }

        await query('COMMIT');

        span?.setAttributes({
          'template.id': templateId,
          'template.variables.count': variables.length,
          'template.category_id': category_id || 'none',
        });

        return await this.getTemplate(templateId, userId);
      } catch (error) {
        await query('ROLLBACK');
        span?.recordException(error);
        throw error;
      }
    });
  }

  /**
   * Instantiate a template as a new workflow
   */
  async instantiateTemplate(templateId, variables = {}, userId) {
    return traceOperation('workflow.template.instantiate', async span => {
      const template = await this.getTemplate(templateId);
      if (!template) {
        throw new Error('Template not found');
      }

      // Validate required variables
      const missingRequired = template.variables
        .filter(v => v.required && !variables.hasOwnProperty(v.var_name))
        .map(v => v.var_name);

      if (missingRequired.length > 0) {
        throw new Error(
          `Missing required variables: ${missingRequired.join(', ')}`
        );
      }

      try {
        await query('BEGIN');

        // Create workflow from template
        const config = { ...template.workflow_data };

        // Replace variables in config (simple string replacement)
        const configStr = JSON.stringify(config);
        let processedConfig = configStr;

        template.variables.forEach(variable => {
          const value =
            variables[variable.var_name] || variable.default_value || '';
          const placeholder = `{{${variable.var_name}}}`;
          processedConfig = processedConfig.replace(
            new RegExp(placeholder, 'g'),
            value
          );
        });

        const workflowQuery = `
          INSERT INTO workflows (name, description, user_id, is_active, base_template_id, workflow_data)
          VALUES ($1, $2, $3, TRUE, $4, $5)
          RETURNING id, created_at
        `;

        const instanceName =
          variables.__workflow_name || `${template.name} Instance`;
        const instanceDescription =
          variables.__workflow_description ||
          `Created from template: ${template.name}`;

        const workflowResult = await query(workflowQuery, [
          instanceName,
          instanceDescription,
          userId,
          templateId,
          processedConfig,
        ]);

        const workflowId = workflowResult.rows[0].id;

        // Record template usage
        await query(
          `
          INSERT INTO workflow_template_usage 
            (template_id, instantiated_workflow_id, user_id, variables_used)
          VALUES ($1, $2, $3, $4)
        `,
          [templateId, workflowId, userId, JSON.stringify(variables)]
        );

        await query('COMMIT');

        span?.setAttributes({
          'template.id': templateId,
          'workflow.id': workflowId,
          'template.variables.provided': Object.keys(variables).length,
        });

        return { workflowId, templateId };
      } catch (error) {
        await query('ROLLBACK');
        span?.recordException(error);
        throw error;
      }
    });
  }

  /**
   * Rate a template
   */
  async rateTemplate(templateId, userId, rating, review = null) {
    return traceOperation('workflow.template.rateTemplate', async span => {
      if (rating < 1 || rating > 5) {
        throw new Error('Rating must be between 1 and 5');
      }

      const upsertQuery = `
        INSERT INTO workflow_template_ratings (template_id, user_id, rating, review)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (template_id, user_id) 
        DO UPDATE SET rating = $3, review = $4, updated_at = NOW()
        RETURNING id, created_at, updated_at
      `;

      const result = await query(upsertQuery, [
        templateId,
        userId,
        rating,
        review,
      ]);

      span?.setAttributes({
        'template.id': templateId,
        'rating.value': rating,
        'rating.has_review': !!review,
      });

      return result.rows[0];
    });
  }

  /**
   * Get template usage statistics
   */
  async getTemplateStats(templateId) {
    return traceOperation('workflow.template.getStats', async span => {
      const statsQuery = `
        SELECT 
          COUNT(DISTINCT wtu.id) as total_usage,
          COUNT(DISTINCT wtu.user_id) as unique_users,
          AVG(wtr.rating) as avg_rating,
          COUNT(DISTINCT wtr.id) as rating_count,
          MAX(wtu.instantiated_at) as last_used
        FROM workflow_template_usage wtu
        LEFT JOIN workflow_template_ratings wtr ON wtu.template_id = wtr.template_id
        WHERE wtu.template_id = $1
      `;

      const result = await query(statsQuery, [templateId]);
      const stats = result.rows[0];

      // Get recent usage
      const recentUsageQuery = `
        SELECT wtu.instantiated_at, u.name as user_name, wtu.variables_used
        FROM workflow_template_usage wtu
        JOIN users u ON wtu.user_id = u.id
        WHERE wtu.template_id = $1
        ORDER BY wtu.instantiated_at DESC
        LIMIT 10
      `;

      const recentResult = await query(recentUsageQuery, [templateId]);

      span?.setAttributes({
        'template.id': templateId,
        'stats.total_usage': parseInt(stats.total_usage) || 0,
        'stats.unique_users': parseInt(stats.unique_users) || 0,
      });

      return {
        ...stats,
        recent_usage: recentResult.rows,
      };
    });
  }
}

export default new WorkflowTemplateService();
