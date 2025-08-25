import { Pool } from 'pg';
import OpenTelemetryTracing from '../system/OpenTelemetryTracing.js';

class WorkflowToolsService {
  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
    this.isInitialized = false;
  }

  async initialize() {
    try {
      console.log(
        '[WorkflowToolsService] 🛠️ Initializing workflow tools service...'
      );

      // Test database connection
      await this.pool.query('SELECT 1');

      this.isInitialized = true;
      console.log('[WorkflowToolsService] ✅ Service initialized successfully');
      return true;
    } catch (error) {
      console.error('[WorkflowToolsService] ❌ Initialization failed:', error);
      return false;
    }
  }

  /**
   * Add a new workflow tool to the database
   */
  async addWorkflowTool(toolData) {
    return OpenTelemetryTracing.traceOperation(
      'workflow-tools.add-tool',
      {
        attributes: {
          'tool.title': toolData.title,
          'tool.type': toolData.tool_type,
          'tool.category': toolData.category_id,
        },
      },
      async span => {
        const {
          title,
          description,
          category_id,
          tool_type,
          complexity_level,
          use_case,
          prerequisites = [],
          technologies = [],
          api_requirements = [],
          estimated_time,
          difficulty_rating,
          implementation_notes,
          example_code,
          related_tools = [],
          tags = [],
          is_white_hat = true,
          requires_permission = false,
          safety_notes,
          search_keywords,
          author,
          license = 'MIT',
          github_url,
          documentation_url,
          embedding,
        } = toolData;

        const query = `
                    INSERT INTO workflow_tools (
                        title, description, category_id, tool_type, complexity_level,
                        use_case, prerequisites, technologies, api_requirements,
                        estimated_time, difficulty_rating, implementation_notes, example_code,
                        related_tools, tags, is_white_hat, requires_permission, safety_notes,
                        search_keywords, author, license, github_url, documentation_url, embedding
                    ) VALUES (
                        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24
                    ) RETURNING id, created_at
                `;

        const values = [
          title,
          description,
          category_id,
          tool_type,
          complexity_level,
          use_case,
          prerequisites,
          technologies,
          api_requirements,
          estimated_time,
          difficulty_rating,
          implementation_notes,
          example_code,
          related_tools,
          tags,
          is_white_hat,
          requires_permission,
          safety_notes,
          search_keywords,
          author,
          license,
          github_url,
          documentation_url,
          embedding,
        ];

        const result = await this.pool.query(query, values);

        span.setAttributes({
          'tool.id': result.rows[0].id,
          'tool.created': true,
        });

        return result.rows[0];
      }
    );
  }

  /**
   * Search workflow tools using vector similarity and full-text search
   */
  async searchWorkflowTools(searchQuery, options = {}) {
    return OpenTelemetryTracing.traceOperation(
      'workflow-tools.search',
      {
        attributes: {
          'search.query': searchQuery,
          'search.limit': options.limit || 20,
        },
      },
      async span => {
        const {
          limit = 20,
          offset = 0,
          category_id,
          tool_type,
          complexity_level,
          embedding, // Vector embedding for semantic search
          similarity_threshold = 0.7,
        } = options;

        let query = `
                    SELECT 
                        wt.*,
                        wc.name as category_name,
                        wc.color as category_color,
                        wc.icon as category_icon,
                        CASE 
                            WHEN $1::vector IS NOT NULL THEN 
                                1 - (wt.embedding <=> $1::vector) AS similarity_score
                            ELSE NULL 
                        END as similarity_score,
                        ts_rank_cd(
                            to_tsvector('english', 
                                COALESCE(wt.title, '') || ' ' || 
                                COALESCE(wt.description, '') || ' ' || 
                                COALESCE(wt.use_case, '') || ' ' ||
                                COALESCE(wt.search_keywords, '')
                            ),
                            plainto_tsquery('english', $2)
                        ) as text_rank
                    FROM workflow_tools wt
                    LEFT JOIN workflow_categories wc ON wt.category_id = wc.id
                    WHERE wt.is_active = true
                `;

        const values = [embedding, searchQuery];
        let paramCount = 2;

        // Add filters
        if (category_id) {
          query += ` AND wt.category_id = $${++paramCount}`;
          values.push(category_id);
        }

        if (tool_type) {
          query += ` AND wt.tool_type = $${++paramCount}`;
          values.push(tool_type);
        }

        if (complexity_level) {
          query += ` AND wt.complexity_level = $${++paramCount}`;
          values.push(complexity_level);
        }

        // Add search conditions
        if (embedding) {
          query += ` AND (1 - (wt.embedding <=> $1::vector)) > $${++paramCount}`;
          values.push(similarity_threshold);
        }

        if (searchQuery) {
          query += ` AND (
                        to_tsvector('english', 
                            COALESCE(wt.title, '') || ' ' || 
                            COALESCE(wt.description, '') || ' ' || 
                            COALESCE(wt.use_case, '') || ' ' ||
                            COALESCE(wt.search_keywords, '')
                        ) @@ plainto_tsquery('english', $2)
                        OR similarity(wt.title, $2) > 0.3
                        OR wt.tags && ARRAY[$2]
                    )`;
        }

        // Order by relevance
        query += `
                    ORDER BY 
                        COALESCE(similarity_score, 0) DESC,
                        COALESCE(text_rank, 0) DESC,
                        wt.popularity_score DESC,
                        wt.created_at DESC
                    LIMIT $${++paramCount} OFFSET $${++paramCount}
                `;

        values.push(limit, offset);

        const result = await this.pool.query(query, values);

        span.setAttributes({
          'search.results_count': result.rows.length,
          'search.has_embedding': !!embedding,
        });

        return result.rows;
      }
    );
  }

  /**
   * Get workflow tool by ID
   */
  async getWorkflowTool(id) {
    return OpenTelemetryTracing.traceOperation(
      'workflow-tools.get-by-id',
      { attributes: { 'tool.id': id } },
      async span => {
        const query = `
                    SELECT 
                        wt.*,
                        wc.name as category_name,
                        wc.color as category_color,
                        wc.icon as category_icon
                    FROM workflow_tools wt
                    LEFT JOIN workflow_categories wc ON wt.category_id = wc.id
                    WHERE wt.id = $1 AND wt.is_active = true
                `;

        const result = await this.pool.query(query, [id]);

        if (result.rows.length > 0) {
          // Increment view count
          await this.pool.query(
            'UPDATE workflow_tools SET views_count = views_count + 1 WHERE id = $1',
            [id]
          );

          span.setAttributes({
            'tool.found': true,
            'tool.title': result.rows[0].title,
          });

          return result.rows[0];
        }

        span.setAttributes({ 'tool.found': false });
        return null;
      }
    );
  }

  /**
   * Add manual section to database
   */
  async addManualSection(sectionData) {
    return OpenTelemetryTracing.traceOperation(
      'user-manual.add-section',
      {
        attributes: {
          'section.title': sectionData.title,
          'section.type': sectionData.section_type,
        },
      },
      async span => {
        const {
          title,
          slug,
          content,
          section_type,
          parent_id,
          sort_order = 0,
          difficulty_level = 'beginner',
          estimated_read_time,
          tags = [],
          related_sections = [],
          search_keywords,
          is_featured = false,
          last_updated_by,
          version = '1.0',
          changelog,
          embedding,
        } = sectionData;

        const query = `
                    INSERT INTO user_manual_sections (
                        title, slug, content, section_type, parent_id, sort_order,
                        difficulty_level, estimated_read_time, tags, related_sections,
                        search_keywords, is_featured, last_updated_by, version, changelog, embedding
                    ) VALUES (
                        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16
                    ) RETURNING id, created_at
                `;

        const values = [
          title,
          slug,
          content,
          section_type,
          parent_id,
          sort_order,
          difficulty_level,
          estimated_read_time,
          tags,
          related_sections,
          search_keywords,
          is_featured,
          last_updated_by,
          version,
          changelog,
          embedding,
        ];

        const result = await this.pool.query(query, values);

        span.setAttributes({
          'section.id': result.rows[0].id,
          'section.created': true,
        });

        return result.rows[0];
      }
    );
  }

  /**
   * Search manual sections
   */
  async searchManualSections(searchQuery, options = {}) {
    return OpenTelemetryTracing.traceOperation(
      'user-manual.search',
      {
        attributes: {
          'search.query': searchQuery,
          'search.limit': options.limit || 20,
        },
      },
      async span => {
        const {
          limit = 20,
          offset = 0,
          section_type,
          difficulty_level,
          embedding,
          similarity_threshold = 0.7,
        } = options;

        let query = `
                    SELECT 
                        *,
                        CASE 
                            WHEN $1::vector IS NOT NULL THEN 
                                1 - (embedding <=> $1::vector) AS similarity_score
                            ELSE NULL 
                        END as similarity_score,
                        ts_rank_cd(
                            to_tsvector('english', 
                                COALESCE(title, '') || ' ' || 
                                COALESCE(content, '') || ' ' ||
                                COALESCE(search_keywords, '')
                            ),
                            plainto_tsquery('english', $2)
                        ) as text_rank
                    FROM user_manual_sections
                    WHERE is_active = true
                `;

        const values = [embedding, searchQuery];
        let paramCount = 2;

        // Add filters
        if (section_type) {
          query += ` AND section_type = $${++paramCount}`;
          values.push(section_type);
        }

        if (difficulty_level) {
          query += ` AND difficulty_level = $${++paramCount}`;
          values.push(difficulty_level);
        }

        // Add search conditions
        if (embedding) {
          query += ` AND (1 - (embedding <=> $1::vector)) > $${++paramCount}`;
          values.push(similarity_threshold);
        }

        if (searchQuery) {
          query += ` AND (
                        to_tsvector('english', 
                            COALESCE(title, '') || ' ' || 
                            COALESCE(content, '') || ' ' ||
                            COALESCE(search_keywords, '')
                        ) @@ plainto_tsquery('english', $2)
                        OR similarity(title, $2) > 0.3
                        OR tags && ARRAY[$2]
                    )`;
        }

        query += `
                    ORDER BY 
                        COALESCE(similarity_score, 0) DESC,
                        COALESCE(text_rank, 0) DESC,
                        sort_order ASC,
                        created_at DESC
                    LIMIT $${++paramCount} OFFSET $${++paramCount}
                `;

        values.push(limit, offset);

        const result = await this.pool.query(query, values);

        span.setAttributes({
          'search.results_count': result.rows.length,
        });

        return result.rows;
      }
    );
  }

  /**
   * Get all categories
   */
  async getCategories() {
    return OpenTelemetryTracing.traceOperation(
      'workflow-tools.get-categories',
      { attributes: {} },
      async span => {
        const query = `
                    SELECT 
                        wc.*,
                        COUNT(wt.id) as tool_count
                    FROM workflow_categories wc
                    LEFT JOIN workflow_tools wt ON wc.id = wt.category_id AND wt.is_active = true
                    WHERE wc.is_active = true
                    GROUP BY wc.id
                    ORDER BY wc.sort_order ASC
                `;

        const result = await this.pool.query(query);

        span.setAttributes({
          'categories.count': result.rows.length,
        });

        return result.rows;
      }
    );
  }

  /**
   * Get trending/popular tools
   */
  async getTrendingTools(limit = 10) {
    return OpenTelemetryTracing.traceOperation(
      'workflow-tools.get-trending',
      { attributes: { limit: limit } },
      async span => {
        const query = `
                    SELECT 
                        wt.*,
                        wc.name as category_name,
                        wc.color as category_color,
                        wc.icon as category_icon
                    FROM workflow_tools wt
                    LEFT JOIN workflow_categories wc ON wt.category_id = wc.id
                    WHERE wt.is_active = true
                    ORDER BY 
                        (wt.views_count * 0.3 + wt.likes_count * 0.7 + wt.popularity_score * 0.5) DESC,
                        wt.created_at DESC
                    LIMIT $1
                `;

        const result = await this.pool.query(query, [limit]);

        span.setAttributes({
          'trending.count': result.rows.length,
        });

        return result.rows;
      }
    );
  }

  /**
   * Log workflow execution
   */
  async logWorkflowExecution(executionData) {
    return OpenTelemetryTracing.traceOperation(
      'workflow-tools.log-execution',
      {
        attributes: {
          'tool.id': executionData.tool_id,
          'execution.status': executionData.execution_status,
        },
      },
      async span => {
        const {
          tool_id,
          user_id,
          execution_status,
          start_time,
          end_time,
          duration_seconds,
          input_parameters,
          output_data,
          error_message,
          execution_context,
        } = executionData;

        const query = `
                    INSERT INTO workflow_execution_logs (
                        tool_id, user_id, execution_status, start_time, end_time,
                        duration_seconds, input_parameters, output_data, error_message,
                        execution_context
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                    RETURNING id, created_at
                `;

        const values = [
          tool_id,
          user_id,
          execution_status,
          start_time,
          end_time,
          duration_seconds,
          input_parameters,
          output_data,
          error_message,
          execution_context,
        ];

        const result = await this.pool.query(query, values);

        span.setAttributes({
          'log.id': result.rows[0].id,
          'log.created': true,
        });

        return result.rows[0];
      }
    );
  }

  /**
   * Get user's favorite tools and manual sections
   */
  async getUserFavorites(userId, favoriteType = null) {
    return OpenTelemetryTracing.traceOperation(
      'workflow-tools.get-user-favorites',
      {
        attributes: {
          'user.id': userId,
          'favorite.type': favoriteType,
        },
      },
      async span => {
        let query, values;

        if (favoriteType === 'tool' || !favoriteType) {
          query = `
                        SELECT 
                            uf.*, 
                            wt.title, wt.description, wt.tool_type, wt.complexity_level,
                            wc.name as category_name, wc.color as category_color, wc.icon as category_icon
                        FROM user_workflow_favorites uf
                        JOIN workflow_tools wt ON uf.tool_id = wt.id
                        LEFT JOIN workflow_categories wc ON wt.category_id = wc.id
                        WHERE uf.user_id = $1 AND uf.favorite_type = 'tool'
                        ORDER BY uf.created_at DESC
                    `;
          values = [userId];
        } else {
          query = `
                        SELECT 
                            uf.*, 
                            ums.title, ums.section_type, ums.difficulty_level
                        FROM user_workflow_favorites uf
                        JOIN user_manual_sections ums ON uf.manual_section_id = ums.id
                        WHERE uf.user_id = $1 AND uf.favorite_type = 'manual'
                        ORDER BY uf.created_at DESC
                    `;
          values = [userId];
        }

        const result = await this.pool.query(query, values);

        span.setAttributes({
          'favorites.count': result.rows.length,
        });

        return result.rows;
      }
    );
  }

  async cleanup() {
    if (this.pool) {
      await this.pool.end();
      console.log('[WorkflowToolsService] 🔽 Service cleanup completed');
    }
  }
}

const workflowToolsService = new WorkflowToolsService();
export default workflowToolsService;
