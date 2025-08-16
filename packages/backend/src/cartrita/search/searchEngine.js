// Cartrita Hybrid Search Engine
// Supports semantic, full-text, and hybrid search using PostgreSQL + pgvector

import { Pool } from 'pg';
import crypto from 'crypto';

class CartritaSearchEngine {
  constructor(pool) {
    this.pool = pool;
    this.initialized = false;
    this.disabled = false;
  }

  async initialize() {
    try {
      // Check if pgvector is available
      await this.pool.query('CREATE EXTENSION IF NOT EXISTS vector');
      await this.pool.query('CREATE EXTENSION IF NOT EXISTS pg_trgm');
      
      // Create search tables if they don't exist
      await this.createSearchTables();
      
      this.initialized = true;
      console.log('✅ Cartrita Search Engine initialized with pgvector + full-text support');
    } catch (error) {
      console.error('❌ Failed to initialize search engine:', error.message);
      this.disabled = true;
      throw error;
    }
  }

  async createSearchTables() {
    const createDocumentsTable = `
      CREATE TABLE IF NOT EXISTS knowledge_documents (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id INTEGER,
        source_url TEXT,
        title TEXT,
        author TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        raw_text TEXT NOT NULL,
        tokens INTEGER,
        meta JSONB DEFAULT '{}'::jsonb
      );
    `;

    const createChunksTable = `
      CREATE TABLE IF NOT EXISTS knowledge_chunks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        document_id UUID REFERENCES knowledge_documents(id) ON DELETE CASCADE,
        user_id INTEGER,
        position INTEGER NOT NULL,
        content TEXT NOT NULL,
        tokens INTEGER,
        embedding vector(1536),
        fulltext_tsv tsvector GENERATED ALWAYS AS (
          to_tsvector('english', coalesce(content,'')) 
        ) STORED,
        meta JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;

    const createIndexes = `
      CREATE INDEX IF NOT EXISTS idx_chunks_doc ON knowledge_chunks(document_id);
      CREATE INDEX IF NOT EXISTS idx_chunks_user ON knowledge_chunks(user_id);
      CREATE INDEX IF NOT EXISTS idx_chunks_embedding ON knowledge_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
      CREATE INDEX IF NOT EXISTS idx_chunks_fulltext ON knowledge_chunks USING GIN (fulltext_tsv);
      CREATE INDEX IF NOT EXISTS idx_chunks_meta_json ON knowledge_chunks USING GIN (meta);
      CREATE INDEX IF NOT EXISTS idx_chunks_trgm ON knowledge_chunks USING GIN (content gin_trgm_ops);
      CREATE INDEX IF NOT EXISTS idx_documents_user ON knowledge_documents(user_id);
    `;

    await this.pool.query(createDocumentsTable);
    await this.pool.query(createChunksTable);
    await this.pool.query(createIndexes);
  }

  async getEmbedding(text) {
    // This would normally call an embedding service
    // For now, return a mock embedding
    if (process.env.NODE_ENV === 'test' || process.env.LIGHTWEIGHT_TEST === '1') {
      return Array(1536).fill(0).map(() => Math.random() - 0.5);
    }
    
    // In real implementation, this would call OpenAI embeddings or similar
    throw new Error('Embedding service not implemented - requires OpenAI API key');
  }

  async semanticSearch(query, options = {}) {
    if (!this.initialized || this.disabled) {
      throw new Error('Search engine not available');
    }

    const { 
      topK = 10, 
      userId = null, 
      documentIds = null,
      threshold = 0.7 
    } = options;

    try {
      const embedding = await this.getEmbedding(query);
      
      let whereClause = '';
      let params = [embedding, topK];
      let paramIndex = 3;

      if (userId) {
        whereClause += ` AND user_id = $${paramIndex}`;
        params.push(userId);
        paramIndex++;
      }

      if (documentIds && Array.isArray(documentIds) && documentIds.length > 0) {
        whereClause += ` AND document_id = ANY($${paramIndex})`;
        params.push(documentIds);
        paramIndex++;
      }

      const semanticQuery = `
        SELECT 
          id, 
          document_id, 
          chunk_text as content, 
          1 - (embedding <=> $1::vector) AS similarity_score,
          metadata as meta,
          created_at
        FROM knowledge_chunks
        WHERE embedding IS NOT NULL ${whereClause}
          AND (1 - (embedding <=> $1::vector)) >= ${threshold}
        ORDER BY embedding <=> $1::vector
        LIMIT $2;
      `;

      const result = await this.pool.query(semanticQuery, params);
      
      return {
        success: true,
        mode: 'semantic',
        query,
        results: result.rows.map(row => ({
          chunk_id: row.id,
          document_id: row.document_id,
          content: row.content,
          similarity: row.similarity_score,
          meta: row.meta,
          created_at: row.created_at
        })),
        resultCount: result.rows.length,
        threshold
      };
    } catch (error) {
      console.error('Semantic search error:', error);
      throw error;
    }
  }

  async fulltextSearch(query, options = {}) {
    if (!this.initialized || this.disabled) {
      throw new Error('Search engine not available');
    }

    const { 
      topK = 10, 
      userId = null, 
      documentIds = null 
    } = options;

    try {
      let whereClause = '';
      let params = [query, topK];
      let paramIndex = 3;

      if (userId) {
        whereClause += ` AND user_id = $${paramIndex}`;
        params.push(userId);
        paramIndex++;
      }

      if (documentIds && Array.isArray(documentIds) && documentIds.length > 0) {
        whereClause += ` AND document_id = ANY($${paramIndex})`;
        params.push(documentIds);
        paramIndex++;
      }

      const fulltextQuery = `
        SELECT 
          id,
          document_id,
          chunk_text as content,
          ts_rank(fulltext_tsv, plainto_tsquery('english', $1)) AS relevance_score,
          metadata as meta,
          created_at
        FROM knowledge_chunks
        WHERE fulltext_tsv @@ plainto_tsquery('english', $1) ${whereClause}
        ORDER BY relevance_score DESC
        LIMIT $2;
      `;

      const result = await this.pool.query(fulltextQuery, params);
      
      return {
        success: true,
        mode: 'fulltext',
        query,
        results: result.rows.map(row => ({
          chunk_id: row.id,
          document_id: row.document_id,
          content: row.content,
          relevance: row.relevance_score,
          meta: row.meta,
          created_at: row.created_at
        })),
        resultCount: result.rows.length
      };
    } catch (error) {
      console.error('Full-text search error:', error);
      throw error;
    }
  }

  async hybridSearch(query, options = {}) {
    if (!this.initialized || this.disabled) {
      throw new Error('Search engine not available');
    }

    const { 
      topK = 10, 
      userId = null, 
      documentIds = null,
      semanticWeight = 0.6,
      fulltextWeight = 0.4,
      threshold = 0.7
    } = options;

    try {
      const embedding = await this.getEmbedding(query);
      
      let whereClause = '';
      let params = [embedding, topK, query, semanticWeight, fulltextWeight, topK];
      let paramIndex = 7;

      if (userId) {
        whereClause += ` AND user_id = $${paramIndex}`;
        params.push(userId);
        paramIndex++;
      }

      if (documentIds && Array.isArray(documentIds) && documentIds.length > 0) {
        whereClause += ` AND document_id = ANY($${paramIndex})`;
        params.push(documentIds);
        paramIndex++;
      }

      const hybridQuery = `
        WITH semantic AS (
          SELECT 
            id, 
            document_id,
            1 - (embedding <=> $1::vector) AS semantic_score,
            chunk_text as content,
            metadata as meta,
            created_at
          FROM knowledge_chunks
          WHERE embedding IS NOT NULL ${whereClause}
          ORDER BY embedding <=> $1::vector
          LIMIT $2
        ),
        fulltext AS (
          SELECT 
            id, 
            document_id,
            ts_rank(fulltext_tsv, plainto_tsquery('english', $3)) AS fulltext_score,
            chunk_text as content,
            metadata as meta,
            created_at
          FROM knowledge_chunks
          WHERE fulltext_tsv @@ plainto_tsquery('english', $3) ${whereClause}
          ORDER BY fulltext_score DESC
          LIMIT $2
        ),
        unioned AS (
          SELECT 
            id, 
            document_id, 
            content,
            semantic_score,
            0::float AS fulltext_score,
            meta,
            created_at
          FROM semantic
          UNION ALL
          SELECT 
            id, 
            document_id, 
            content,
            0::float AS semantic_score,
            fulltext_score,
            meta,
            created_at
          FROM fulltext
        ),
        scored AS (
          SELECT 
            id, 
            document_id, 
            content,
            MAX(semantic_score) AS semantic_score,
            MAX(fulltext_score) AS fulltext_score,
            meta,
            created_at
          FROM unioned
          GROUP BY id, document_id, content, meta, created_at
        )
        SELECT *,
               (semantic_score * $4 + fulltext_score * $5) AS hybrid_score
        FROM scored
        WHERE (semantic_score * $4 + fulltext_score * $5) >= ${threshold}
        ORDER BY hybrid_score DESC
        LIMIT $6;
      `;

      const result = await this.pool.query(hybridQuery, params);
      
      return {
        success: true,
        mode: 'hybrid',
        query,
        results: result.rows.map(row => ({
          chunk_id: row.id,
          document_id: row.document_id,
          content: row.content,
          hybrid_score: row.hybrid_score,
          semantic_score: row.semantic_score,
          fulltext_score: row.fulltext_score,
          meta: row.meta,
          created_at: row.created_at
        })),
        resultCount: result.rows.length,
        weights: { semantic: semanticWeight, fulltext: fulltextWeight },
        threshold
      };
    } catch (error) {
      console.error('Hybrid search error:', error);
      throw error;
    }
  }

  async executeSearch(params) {
    const { 
      query, 
      mode = 'hybrid', 
      traceId = crypto.randomUUID(),
      ...options 
    } = params;

    if (!query || typeof query !== 'string') {
      throw new Error('Query is required and must be a string');
    }

    const startTime = Date.now();

    try {
      let result;
      
      switch (mode) {
        case 'semantic':
          result = await this.semanticSearch(query, options);
          break;
        case 'fulltext':
          result = await this.fulltextSearch(query, options);
          break;
        case 'hybrid':
          result = await this.hybridSearch(query, options);
          break;
        default:
          throw new Error(`Unsupported search mode: ${mode}`);
      }

      return {
        traceId,
        processingTime: Date.now() - startTime,
        ...result
      };
    } catch (error) {
      return {
        traceId,
        processingTime: Date.now() - startTime,
        success: false,
        error: 'SEARCH_FAILED',
        message: error.message,
        mode
      };
    }
  }

  // Resilient search with fallback chain
  async resilientSearch(params) {
    const { mode = 'hybrid' } = params;
    
    const attemptOrder = mode === 'hybrid' 
      ? ['hybrid', 'semantic', 'fulltext']
      : mode === 'semantic' 
      ? ['semantic', 'fulltext']
      : ['fulltext', 'semantic'];

    const errors = [];
    
    for (const searchMode of attemptOrder) {
      try {
        const result = await this.executeSearch({ ...params, mode: searchMode });
        if (!result.error && result.results?.length > 0) {
          return {
            ...result,
            fallbackChain: attemptOrder.slice(0, attemptOrder.indexOf(searchMode) + 1),
            errors: errors.length > 0 ? errors : undefined
          };
        }
        if (result.error) {
          errors.push({ mode: searchMode, error: result.message });
        }
      } catch (error) {
        errors.push({ mode: searchMode, error: error.message });
      }
    }

    return {
      success: false,
      error: 'ALL_SEARCH_MODES_FAILED',
      fallbackChain: attemptOrder,
      errors,
      traceId: params.traceId || crypto.randomUUID()
    };
  }
}

export default CartritaSearchEngine;