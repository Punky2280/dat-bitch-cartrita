/**
 * Advanced Knowledge Hub Service
 * Implements Graph RAG with Vector Embeddings and Semantic Clustering
 * Features: CRUD operations, semantic search, clustering, analytics
 */

import pkg from 'pg';
import OpenAI from 'openai';
import mlDistance from 'ml-distance';
import kmeansLib from 'ml-kmeans';
import natural from 'natural';
import EmbeddingPipeline from './EmbeddingPipeline.js';

const { cosineDistance } = mlDistance;
const kmeans = kmeansLib;

const { Pool } = pkg;

class KnowledgeHubService {
  constructor() {
    this.pool = new Pool({
      user: process.env.POSTGRES_USER || 'robert',
      host: process.env.POSTGRES_HOST || 'localhost',
      database: process.env.POSTGRES_DB || 'dat-bitch-cartrita',
      password: process.env.POSTGRES_PASSWORD || 'punky1',
      port: process.env.POSTGRES_PORT || 5435,
    });

    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    this.stemmer = natural.PorterStemmer;
    this.stopwords = new Set(natural.stopwords);

    console.log('[KnowledgeHub] 🧠 Advanced Knowledge Hub Service initialized');

    // Initialize analytics tracking
    this.analytics = {
      searches: 0,
      entries_created: 0,
      embeddings_generated: 0,
    };
  }

  /**
   * Create a new knowledge entry with semantic embeddings
   */
  async createEntry(entryData, userId) {
    try {
      console.log(`[KnowledgeHub] ✨ Creating entry: "${entryData.title}"`);

      const {
        title,
        content,
        content_type = 'text',
        category = 'general',
        subcategory,
        tags = [],
        importance_score = 0.5,
        source_type = 'user_created',
        source_url,
      } = entryData;

      // Clean and process content
      const cleanedContent = this.cleanContent(content);
      const wordCount = cleanedContent.split(/\s+/).length;
      const entryContentLength = content.length;

      // Generate embeddings
      const contentEmbedding = await this.generateEmbedding(cleanedContent);
      const titleEmbedding = await this.generateEmbedding(title);

      // Calculate content metrics
      const sentimentScore = this.analyzeSentiment(cleanedContent);
      const complexityScore = this.calculateComplexity(cleanedContent);

      const query = `
                INSERT INTO knowledge_entries (
                    author_id, title, content, content_type, category, tags,
                    content_embedding, title_embedding, importance_score, confidence_score,
                    content_length, word_count, sentiment_score, complexity_score,
                    source_type, source_url
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
                RETURNING *
            `;

      const values = [
        userId,
        title,
        content,
        content_type,
        category,
        tags,
        `[${contentEmbedding.join(',')}]`,
        `[${titleEmbedding.join(',')}]`,
        importance_score,
        0.9,
        entryContentLength,
        wordCount,
        sentimentScore,
        complexityScore,
        'user_created',
        source_url,
      ];

      const result = await this.pool.query(query, values);
      const entry = result.rows[0];

      // Queue additional processing via pipeline
      EmbeddingPipeline.emit('entry-created', {
        entryId: entry.id,
        embedding: contentEmbedding,
      });

      // Auto-assign to clusters
      await this.autoAssignClusters(entry.id, contentEmbedding);

      console.log(`[KnowledgeHub] ✅ Entry created with ID: ${entry.id}`);
      return { success: true, entry };
    } catch (error) {
      console.error('[KnowledgeHub] ❌ Error creating entry:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get all knowledge entries with filtering and pagination
   */
  async getEntries(userId, options = {}) {
    try {
      const {
        category,
        content_type,
        tags,
        importance_min = 0,
        limit = 50,
        offset = 0,
        sort_by = 'created_at',
        sort_order = 'DESC',
      } = options;

      let whereClause = 'WHERE ke.user_id = $1';
      const values = [userId];
      let paramCount = 1;

      if (category && category !== 'all') {
        whereClause += ` AND ke.category = $${++paramCount}`;
        values.push(category);
      }

      if (content_type && content_type !== 'all') {
        whereClause += ` AND ke.content_type = $${++paramCount}`;
        values.push(content_type);
      }

      if (tags && tags.length > 0) {
        whereClause += ` AND ke.tags && $${++paramCount}`;
        values.push(tags);
      }

      if (importance_min > 0) {
        whereClause += ` AND ke.importance_score >= $${++paramCount}`;
        values.push(importance_min);
      }

      // Simplified query without joins for now
      const query = `
                SELECT 
                    ke.*,
                    ARRAY[]::text[] as cluster_names
                FROM knowledge_entries ke
                ${whereClause}
                ORDER BY ke.${sort_by} ${sort_order}
                LIMIT $${++paramCount} OFFSET $${++paramCount}
            `;

      values.push(limit, offset);

      const result = await this.pool.query(query, values);

      console.log(`[KnowledgeHub] 📚 Retrieved ${result.rows.length} entries`);
      return { success: true, entries: result.rows, total: result.rows.length };
    } catch (error) {
      console.error('[KnowledgeHub] ❌ Error getting entries:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Perform semantic search using vector similarity
   */
  async semanticSearch(query, userId, options = {}) {
    try {
      const { limit = 20, threshold = 0.7, include_content = true } = options;

      console.log(`[KnowledgeHub] 🔍 Semantic search: "${query}"`);

      // Generate query embedding
      const queryEmbedding = await this.generateEmbedding(query);

      // Vector similarity search using content_embedding
      const searchQuery = `
                SELECT 
                    ke.*,
                    1 - (ke.content_embedding <=> $1::vector) as similarity,
                    COALESCE(
                        ARRAY_AGG(
                            DISTINCT kc.name
                        ) FILTER (WHERE kc.name IS NOT NULL), 
                        ARRAY[]::text[]
                    ) as cluster_names
                FROM knowledge_entries ke
                LEFT JOIN knowledge_entry_clusters kec ON ke.id = kec.entry_id
                LEFT JOIN knowledge_clusters kc ON kec.cluster_id = kc.id
                WHERE ke.user_id = $2
                    AND ke.content_embedding IS NOT NULL
                    AND 1 - (ke.content_embedding <=> $1::vector) >= $3
                GROUP BY ke.id, ke.content_embedding
                ORDER BY ke.content_embedding <=> $1::vector
                LIMIT $4
            `;

      const values = [
        `[${queryEmbedding.join(',')}]`,
        userId,
        threshold,
        limit,
      ];
      const result = await this.pool.query(searchQuery, values);

      // Process results
      const results = result.rows.map(row => ({
        id: row.id,
        title: row.title,
        content: include_content
          ? row.content
          : row.content.substring(0, 300) + '...',
        similarity: parseFloat(row.similarity.toFixed(4)),
        cluster_names: row.cluster_names || [],
        category: row.category,
        content_type: row.content_type,
        importance_score: row.importance_score,
      }));

      console.log(`[KnowledgeHub] ✅ Found ${results.length} semantic matches`);
      return { success: true, results };
    } catch (error) {
      console.error('[KnowledgeHub] ❌ Semantic search error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get knowledge clusters with statistics
   */
  async getClusters(userId) {
    try {
      const query = `
                SELECT 
                    kc.*,
                    COUNT(kec.entry_id) as entry_count,
                    AVG(ke.importance_score) as avg_importance,
                    SUM(ke.access_count) as total_access_count
                FROM knowledge_clusters kc
                LEFT JOIN knowledge_entry_clusters kec ON kc.id = kec.cluster_id
                LEFT JOIN knowledge_entries ke ON kec.entry_id = ke.id AND ke.user_id = $1
                WHERE kc.user_id = $1
                GROUP BY kc.id
                ORDER BY entry_count DESC, kc.created_at DESC
            `;

      const result = await this.pool.query(query, [userId]);

      const clusters = result.rows.map(row => ({
        ...row,
        entry_count: parseInt(row.entry_count) || 0,
        avg_importance: parseFloat(row.avg_importance) || 0,
        total_access_count: parseInt(row.total_access_count) || 0,
        color: row.cluster_data?.color || '#8b5cf6',
        size: Math.max(row.entry_count * 2 + 10, 15),
      }));

      console.log(`[KnowledgeHub] 🎯 Retrieved ${clusters.length} clusters`);
      return { success: true, clusters };
    } catch (error) {
      console.error('[KnowledgeHub] ❌ Error getting clusters:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Generate knowledge graph for visualization
   */
  async generateGraph(userId) {
    try {
      console.log('[KnowledgeHub] 🕸️ Generating knowledge graph...');

      // Get all entries and relationships
      const [entriesResult, relationshipsResult] = await Promise.all([
        this.pool.query(
          'SELECT id, title, category, content_type, importance_score FROM knowledge_entries WHERE user_id = $1',
          [userId]
        ),
        this.pool.query(
          `
                    SELECT source_document_id as source_id, target_document_id as target_id, 
                           relationship_type, similarity_score as strength
                    FROM knowledge_relationships 
                    WHERE user_id = $1 AND similarity_score >= 0.6
                `,
          [userId]
        ),
      ]);

      const entries = entriesResult.rows;
      const relationships = relationshipsResult.rows;

      // Build graph structure
      const nodes = entries.map(entry => ({
        id: entry.id,
        title: entry.title,
        category: entry.category,
        content_type: entry.content_type,
        importance_score: entry.importance_score,
      }));

      const edges = relationships.map(rel => ({
        source_entry_id: rel.source_id,
        target_entry_id: rel.target_id,
        relationship_type: rel.relationship_type,
        strength: rel.strength || 0.5,
      }));

      console.log(
        `[KnowledgeHub] ✅ Graph generated: ${nodes.length} nodes, ${edges.length} edges`
      );
      return { success: true, graph: { nodes, edges } };
    } catch (error) {
      console.error('[KnowledgeHub] ❌ Error generating graph:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Perform automatic clustering using K-means on embeddings
   */
  async performClustering(userId, numClusters = 5) {
    try {
      console.log(
        `[KnowledgeHub] 🧩 Performing K-means clustering with ${numClusters} clusters...`
      );

      // Get all entries with embeddings
      const result = await this.pool.query(
        'SELECT id, title, content_embedding FROM knowledge_entries WHERE user_id = $1 AND content_embedding IS NOT NULL',
        [userId]
      );

      if (result.rows.length < numClusters) {
        console.log('[KnowledgeHub] ⚠️ Not enough entries for clustering');
        return { success: false, error: 'Not enough entries for clustering' };
      }

      // Extract embeddings
      const entries = result.rows;
      const embeddings = entries.map(entry => {
        // Parse the vector format
        const embeddingStr = entry.content_embedding.replace(/[\\[\\]]/g, '');
        return embeddingStr.split(',').map(x => parseFloat(x));
      });

      // Perform K-means clustering
      const clusters = kmeans(embeddings, numClusters, {
        initialization: 'kmeans++',
      });

      // Create cluster records
      const clusterPromises = clusters.centroids.map(async (centroid, idx) => {
        const clusterName = `Auto Cluster ${idx + 1}`;
        const clusterQuery = `
                    INSERT INTO knowledge_clusters (user_id, name, description, cluster_data)
                    VALUES ($1, $2, $3, $4)
                    RETURNING id
                `;

        const clusterData = {
          algorithm: 'kmeans',
          centroid: centroid,
          color: this.generateClusterColor(idx),
          created_by: 'auto_clustering',
        };

        const clusterResult = await this.pool.query(clusterQuery, [
          userId,
          clusterName,
          `Automatically generated cluster using K-means algorithm`,
          JSON.stringify(clusterData),
        ]);

        return { id: clusterResult.rows[0].id, centroid };
      });

      const clusterRecords = await Promise.all(clusterPromises);

      // Assign entries to clusters
      const assignmentPromises = entries.map(async (entry, idx) => {
        const clusterId = clusters.clusters[idx];
        const clusterDbId = clusterRecords[clusterId].id;

        await this.pool.query(
          'INSERT INTO knowledge_entry_clusters (entry_id, cluster_id, membership_strength) VALUES ($1, $2, $3)',
          [entry.id, clusterDbId, 0.8]
        );
      });

      await Promise.all(assignmentPromises);

      console.log(
        `[KnowledgeHub] ✅ Clustering completed: ${clusterRecords.length} clusters created`
      );
      return { success: true, clusters_created: clusterRecords.length };
    } catch (error) {
      console.error('[KnowledgeHub] ❌ Clustering error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Generate analytics and metrics
   */
  async getAnalytics(userId, dateRange = 7) {
    try {
      console.log(
        `[KnowledgeHub] 📊 Generating analytics for ${dateRange} days...`
      );

      const baseQuery = `
                SELECT 
                    COUNT(*) as total_entries,
                    AVG(importance_score) as avg_importance,
                    COUNT(DISTINCT category) as categories_count,
                    AVG(access_count) as avg_access_count,
                    AVG(word_count) as avg_word_count,
                    COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '${dateRange} days') as recent_entries
                FROM knowledge_entries 
                WHERE user_id = $1
            `;

      const clustersQuery = `
                SELECT COUNT(*) as total_clusters
                FROM knowledge_clusters
                WHERE user_id = $1
            `;

      const relationshipsQuery = `
                SELECT 
                    COUNT(*) as total_relationships,
                    AVG(similarity_score) as avg_similarity
                FROM knowledge_relationships
                WHERE user_id = $1
            `;

      const [baseResult, clustersResult, relationshipsResult] =
        await Promise.all([
          this.pool.query(baseQuery, [userId]),
          this.pool.query(clustersQuery, [userId]),
          this.pool.query(relationshipsQuery, [userId]),
        ]);

      const analytics = {
        ...baseResult.rows[0],
        ...clustersResult.rows[0],
        ...relationshipsResult.rows[0],
        knowledge_density:
          relationshipsResult.rows[0].total_relationships /
          Math.max(baseResult.rows[0].total_entries, 1),
        generated_at: new Date().toISOString(),
      };

      // Convert string numbers to integers/floats
      Object.keys(analytics).forEach(key => {
        if (
          key.includes('count') ||
          key === 'total_entries' ||
          key === 'categories_count'
        ) {
          analytics[key] = parseInt(analytics[key]) || 0;
        } else if (
          key.includes('avg_') ||
          key.includes('score') ||
          key === 'knowledge_density'
        ) {
          analytics[key] = parseFloat(analytics[key]) || 0;
        }
      });

      console.log(
        `[KnowledgeHub] ✅ Analytics generated: ${analytics.total_entries} entries, ${analytics.total_clusters} clusters`
      );
      return { success: true, analytics };
    } catch (error) {
      console.error('[KnowledgeHub] ❌ Analytics error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Helper: Generate OpenAI embeddings
   */
  async generateEmbedding(text) {
    try {
      const response = await this.openai.embeddings.create({
        model: 'text-embedding-3-large', // 3072 dimensions to match schema
        input: text.substring(0, 8000), // Limit input length
      });

      return response.data[0].embedding;
    } catch (error) {
      console.error('[KnowledgeHub] ❌ Embedding generation error:', error);
      // Return zero vector as fallback
      return new Array(3072).fill(0);
    }
  }

  /**
   * Helper: Auto-assign entries to existing clusters
   */
  async autoAssignClusters(entryId, embedding) {
    try {
      // Find closest clusters (simplified for now)
      const result = await this.pool.query(
        'SELECT id FROM knowledge_clusters ORDER BY RANDOM() LIMIT 1'
      );

      if (result.rows.length > 0) {
        await this.pool.query(
          'INSERT INTO knowledge_entry_clusters (entry_id, cluster_id, membership_strength) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
          [entryId, result.rows[0].id, 0.7]
        );
      }
    } catch (error) {
      console.error('[KnowledgeHub] ⚠️ Auto-clustering error:', error);
    }
  }

  /**
   * Helper: Discover relationships between entries
   */
  async discoverRelationships(entryId, embedding) {
    try {
      // Find similar entries (simplified)
      const result = await this.pool.query(
        'SELECT id FROM knowledge_entries WHERE id != $1 ORDER BY RANDOM() LIMIT 2',
        [entryId]
      );

      for (const row of result.rows) {
        await this.pool.query(
          `
                    INSERT INTO knowledge_relationships 
                    (source_entry_id, target_entry_id, relationship_type, strength, confidence)
                    VALUES ($1, $2, $3, $4, $5)
                    ON CONFLICT DO NOTHING
                `,
          [entryId, row.id, 'similar_to', 0.75, 0.8]
        );
      }
    } catch (error) {
      console.error('[KnowledgeHub] ⚠️ Relationship discovery error:', error);
    }
  }

  /**
   * Helper: Analyze text sentiment
   */
  analyzeSentiment(text) {
    // Simple sentiment analysis (can be improved with proper NLP)
    const positiveWords = [
      'good',
      'great',
      'excellent',
      'amazing',
      'wonderful',
      'positive',
      'beneficial',
    ];
    const negativeWords = [
      'bad',
      'terrible',
      'awful',
      'negative',
      'problem',
      'issue',
      'error',
    ];

    const words = text.toLowerCase().split(/\\s+/);
    let score = 0;

    words.forEach(word => {
      if (positiveWords.includes(word)) score += 0.1;
      if (negativeWords.includes(word)) score -= 0.1;
    });

    return Math.max(-1, Math.min(1, score));
  }

  /**
   * Helper: Calculate text complexity
   */
  calculateComplexity(text) {
    const sentences = text.split(/[.!?]+/).length;
    const words = text.split(/\\s+/).length;
    const avgWordsPerSentence = words / Math.max(sentences, 1);

    // Flesch Reading Ease approximation (simplified)
    return Math.max(0, Math.min(1, (avgWordsPerSentence - 10) / 20));
  }

  /**
   * Helper: Generate cluster colors
   */
  generateClusterColor(index) {
    const colors = [
      '#8b5cf6',
      '#06b6d4',
      '#10b981',
      '#f59e0b',
      '#ef4444',
      '#8b5cf6',
      '#ec4899',
      '#14b8a6',
    ];
    return colors[index % colors.length];
  }

  /**
   * Get a specific knowledge entry by ID
   */
  async getEntryById(entryId, userId) {
    try {
      const query = `
                SELECT ke.*, 
                       COALESCE(
                           ARRAY_AGG(DISTINCT kc.name) FILTER (WHERE kc.name IS NOT NULL), 
                           ARRAY[]::text[]
                       ) as cluster_names
                FROM knowledge_entries ke
                LEFT JOIN knowledge_entry_clusters kec ON ke.id = kec.entry_id
                LEFT JOIN knowledge_clusters kc ON kec.cluster_id = kc.id
                WHERE ke.id = $1 AND ke.user_id = $2
                GROUP BY ke.id
            `;

      const result = await this.pool.query(query, [entryId, userId]);
      return result.rows[0] || null;
    } catch (error) {
      console.error('[KnowledgeHub] ❌ Error getting entry by ID:', error);
      return null;
    }
  }

  /**
   * Update a knowledge entry
   */
  async updateEntry(entryId, updateData, userId) {
    try {
      console.log(`[KnowledgeHub] 📝 Updating entry ${entryId}`);

      const existingEntry = await this.getEntryById(entryId, userId);
      if (!existingEntry) return null;

      const {
        title = existingEntry.title,
        content = existingEntry.content,
        content_type = existingEntry.content_type,
        category = existingEntry.category,
        subcategory = existingEntry.subcategory,
        tags = existingEntry.tags,
        importance_score = existingEntry.importance_score,
        source_url = existingEntry.source_url,
      } = updateData;

      // Regenerate embeddings if content changed
      let contentEmbedding = existingEntry.content_embedding;
      let titleEmbedding = existingEntry.title_embedding;

      if (content !== existingEntry.content) {
        contentEmbedding = await this.generateEmbedding(content);
      }
      if (title !== existingEntry.title) {
        titleEmbedding = await this.generateEmbedding(title);
      }

      const query = `
                UPDATE knowledge_entries 
                SET title = $1, content = $2, content_type = $3, category = $4, 
                    subcategory = $5, tags = $6, importance_score = $7, source_url = $8,
                    content_embedding = $9, title_embedding = $10, updated_at = NOW()
                WHERE id = $11 AND user_id = $12
                RETURNING *
            `;

      const values = [
        title,
        content,
        content_type,
        category,
        subcategory,
        tags,
        importance_score,
        source_url,
        `[${contentEmbedding.join(',')}]`,
        `[${titleEmbedding.join(',')}]`,
        entryId,
        userId,
      ];

      const result = await this.pool.query(query, values);
      return result.rows[0];
    } catch (error) {
      console.error('[KnowledgeHub] ❌ Error updating entry:', error);
      return null;
    }
  }

  /**
   * Delete a knowledge entry
   */
  async deleteEntry(entryId, userId) {
    try {
      console.log(`[KnowledgeHub] 🗑️ Deleting entry ${entryId}`);

      const result = await this.pool.query(
        'DELETE FROM knowledge_entries WHERE id = $1 AND user_id = $2 RETURNING id',
        [entryId, userId]
      );

      return result.rows.length > 0;
    } catch (error) {
      console.error('[KnowledgeHub] ❌ Error deleting entry:', error);
      return false;
    }
  }

  /**
   * Search knowledge entries
   */
  async searchEntries(searchData, userId, sessionId) {
    try {
      const {
        query,
        search_type = 'semantic',
        limit = 20,
        threshold = 0.7,
      } = searchData;

      if (search_type === 'semantic') {
        return this.semanticSearch(query, userId, { limit, threshold });
      } else {
        // Fallback to simple text search
        const searchQuery = `
                    SELECT * FROM knowledge_entries 
                    WHERE user_id = $1 AND (
                        title ILIKE $2 OR content ILIKE $2
                    )
                    ORDER BY created_at DESC
                    LIMIT $3
                `;

        const result = await this.pool.query(searchQuery, [
          userId,
          `%${query}%`,
          limit,
        ]);
        return { success: true, results: result.rows };
      }
    } catch (error) {
      console.error('[KnowledgeHub] ❌ Error searching entries:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Create a knowledge cluster
   */
  async createCluster(clusterData, userId) {
    try {
      const {
        name,
        description,
        cluster_type = 'semantic',
        color = '#6366f1',
      } = clusterData;

      const query = `
                INSERT INTO knowledge_clusters (user_id, name, description, cluster_data, created_at)
                VALUES ($1, $2, $3, $4, NOW())
                RETURNING *
            `;

      const clusterMetadata = {
        cluster_type,
        color,
        auto_update: true,
      };

      const result = await this.pool.query(query, [
        userId,
        name,
        description,
        JSON.stringify(clusterMetadata),
      ]);

      return result.rows[0];
    } catch (error) {
      console.error('[KnowledgeHub] ❌ Error creating cluster:', error);
      return null;
    }
  }

  /**
   * Auto-cluster entries using ML algorithms
   */
  async autoClusterEntries(options) {
    try {
      const { algorithm = 'kmeans', num_clusters = 5 } = options;

      if (algorithm === 'kmeans') {
        return this.performClustering(null, num_clusters);
      }

      return { success: false, error: 'Unsupported clustering algorithm' };
    } catch (error) {
      console.error('[KnowledgeHub] ❌ Error auto-clustering:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get knowledge graph data for visualization
   */
  async getGraphData(options = {}) {
    try {
      return this.generateGraph(null); // userId handled internally
    } catch (error) {
      console.error('[KnowledgeHub] ❌ Error getting graph data:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Create relationship between entries
   */
  async createRelationship(relationshipData) {
    try {
      const {
        source_entry_id,
        target_entry_id,
        relationship_type,
        strength = 0.5,
      } = relationshipData;

      const query = `
                INSERT INTO knowledge_relationships 
                (source_entry_id, target_entry_id, relationship_type, strength, discovered_by, created_at)
                VALUES ($1, $2, $3, $4, 'manual', NOW())
                RETURNING *
            `;

      const result = await this.pool.query(query, [
        source_entry_id,
        target_entry_id,
        relationship_type,
        strength,
      ]);

      return result.rows[0];
    } catch (error) {
      console.error('[KnowledgeHub] ❌ Error creating relationship:', error);
      return null;
    }
  }

  /**
   * Get health status of the service
   */
  async getHealthStatus() {
    try {
      const dbTest = await this.pool.query('SELECT 1');
      const embeddingTest = this.openai ? true : false;

      return {
        status: 'healthy',
        database: dbTest.rows.length > 0 ? 'connected' : 'disconnected',
        embedding_service: embeddingTest ? 'available' : 'unavailable',
        timestamp: new Date().toISOString(),
        version: '2.0.0',
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Helper: Clean content before processing
   */
  cleanContent(content) {
    return content
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s.,!?-]/g, '')
      .trim();
  }

  /**
   * Get service statistics
   */
  getServiceStats() {
    return {
      service: 'KnowledgeHubService',
      version: '2.0.0',
      features: [
        'Vector Embeddings',
        'Semantic Search',
        'K-means Clustering',
        'Graph Generation',
        'Analytics',
      ],
      models: {
        embedding: 'text-embedding-3-small',
        clustering: 'k-means',
        sentiment: 'rule-based',
      },
    };
  }
}

export default KnowledgeHubService;
