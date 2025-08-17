/**
 * Enhanced RAG Service
 * Comprehensive RAG implementation with document ingestion, vector search, and response generation
 * Integrates Gemini embeddings with existing knowledge hub infrastructure
 */

import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import GeminiEmbeddingService from './GeminiEmbeddingService.js';
import pool from '../db.js';
import crypto from 'crypto';
import OpenTelemetryTracing from '../system/OpenTelemetryTracing.js';

export default class EnhancedRAGService {
  constructor() {
    this.geminiEmbedding = new GeminiEmbeddingService();
    this.initialized = false;
    
    // Configuration with defaults
    this.config = {
      chunkSize: parseInt(process.env.RAG_CHUNK_SIZE) || 1000,
      chunkOverlap: parseInt(process.env.RAG_CHUNK_OVERLAP) || 200,
      similarityThreshold: parseFloat(process.env.RAG_SIMILARITY_THRESHOLD) || 0.7,
      topK: parseInt(process.env.RAG_TOP_K) || 5,
      enabled: process.env.RAG_ENABLED === 'true' || process.env.RAG_ENABLED === '1',
    };

    this.textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: this.config.chunkSize,
      chunkOverlap: this.config.chunkOverlap,
      separators: ['\n\n', '\n', '. ', '! ', '? ', '; ', ': ', ' ', ''],
    });

    this.supportedMimeTypes = [
      'text/plain',
      'text/markdown',
      'application/json',
      'text/html',
      'text/csv'
    ];
  }

  async initialize() {
    try {
      if (!this.config.enabled) {
        console.log('[EnhancedRAG] ⚠️ RAG disabled by configuration (RAG_ENABLED=false)');
        return false;
      }

      // Initialize Gemini embedding service
      const geminiReady = await this.geminiEmbedding.initialize();
      if (!geminiReady) {
        console.warn('[EnhancedRAG] ⚠️ Gemini embedding service unavailable');
        return false;
      }

      // Verify database tables exist
      await this.verifyDatabaseTables();
      
      this.initialized = true;
      console.log('[EnhancedRAG] ✅ Enhanced RAG service initialized successfully');
      return true;
    } catch (error) {
      console.error('[EnhancedRAG] ❌ Initialization failed:', error.message);
      return false;
    }
  }

  async verifyDatabaseTables() {
    try {
      // Check if required tables exist - use existing knowledge tables from schema
      const tableCheck = await pool.query(`
        SELECT tablename FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename IN ('knowledge_documents', 'knowledge_chunks')
      `);
      
      if (tableCheck.rows.length < 2) {
        console.warn('[EnhancedRAG] ⚠️ Required knowledge tables not found, some features may be limited');
      }
    } catch (error) {
      console.warn('[EnhancedRAG] ⚠️ Database verification failed:', error.message);
    }
  }

  /**
   * Ingest a document into the RAG system
   */
  async ingestDocument(userId, documentData, fileBuffer = null) {
    return OpenTelemetryTracing.traceOperation('rag.document.ingest', {}, async () => {
      if (!this.initialized) {
        throw new Error('RAG service not initialized');
      }

      const { 
        title, 
        content, 
        mimeType = 'text/plain',
        metadata = {},
        source = 'user_upload'
      } = documentData;

      if (!title || (!content && !fileBuffer)) {
        throw new Error('Document title and content are required');
      }

      let documentContent = content;
      
      // Process file buffer if provided
      if (fileBuffer) {
        documentContent = await this.extractTextFromBuffer(fileBuffer, mimeType);
      }

      if (!documentContent || documentContent.trim().length === 0) {
        throw new Error('Document content is empty or could not be extracted');
      }

      try {
        // Generate document ID
        const documentId = crypto.randomUUID();
        
        // Split document into chunks
        const chunks = await this.textSplitter.splitText(documentContent);
        
        if (chunks.length === 0) {
          throw new Error('No chunks generated from document');
        }

        // Generate embeddings for all chunks
        const embeddings = await this.geminiEmbedding.generateEmbeddings(chunks);
        
        // Begin transaction
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          
          // Insert document record
          const documentInsert = await client.query(`
            INSERT INTO knowledge_documents 
            (id, user_id, title, content, file_size, mime_type, metadata, source_type, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
            RETURNING id, created_at
          `, [
            documentId,
            userId,
            title,
            documentContent,
            documentContent.length,
            mimeType,
            JSON.stringify(metadata),
            source
          ]);

          // Insert chunks with embeddings
          for (let i = 0; i < chunks.length; i++) {
            const chunkText = chunks[i];
            const embedding = embeddings[i];
            
            // Format vector for PostgreSQL
            const vectorString = `[${embedding.join(',')}]`;
            
            await client.query(`
              INSERT INTO knowledge_chunks 
              (document_id, user_id, chunk_text, chunk_index, chunk_tokens, embedding, metadata)
              VALUES ($1, $2, $3, $4, $5, $6::vector, $7)
            `, [
              documentId,
              userId,
              chunkText,
              i,
              Math.ceil(chunkText.length / 4), // Approximate token count
              vectorString,
              JSON.stringify({ chunk_size: chunkText.length, created_at: new Date().toISOString() })
            ]);
          }

          await client.query('COMMIT');
          
          return {
            success: true,
            documentId,
            title,
            chunksCreated: chunks.length,
            totalTokens: chunks.reduce((sum, chunk) => sum + Math.ceil(chunk.length / 4), 0),
            createdAt: documentInsert.rows[0].created_at
          };
          
        } catch (error) {
          await client.query('ROLLBACK');
          throw error;
        } finally {
          client.release();
        }
      } catch (error) {
        console.error('[EnhancedRAG] ❌ Document ingestion failed:', error.message);
        throw new Error(`Document ingestion failed: ${error.message}`);
      }
    });
  }

  /**
   * Search for similar documents/chunks using vector similarity
   */
  async searchSimilar(userId, query, options = {}) {
    return OpenTelemetryTracing.traceOperation('rag.search.similarity', {}, async () => {
      if (!this.initialized) {
        throw new Error('RAG service not initialized');
      }

      const {
        limit = this.config.topK,
        threshold = this.config.similarityThreshold,
        documentIds = null,
        includeChunks = true,
        includeDocuments = false
      } = options;

      try {
        // Generate query embedding
        const queryEmbedding = await this.geminiEmbedding.generateEmbeddings(query);
        const vectorString = `[${queryEmbedding.join(',')}]`;

        // Build search query
        let searchQuery = `
          SELECT 
            c.document_id,
            c.chunk_text,
            c.chunk_index,
            c.chunk_tokens,
            d.title as document_title,
            d.metadata as document_metadata,
            1 - (c.embedding <=> $1::vector) as similarity
          FROM knowledge_chunks c
          JOIN knowledge_documents d ON c.document_id = d.id
          WHERE c.user_id = $2
        `;
        
        const queryParams = [vectorString, userId];
        let paramCount = 2;

        if (documentIds && documentIds.length > 0) {
          paramCount++;
          searchQuery += ` AND c.document_id = ANY($${paramCount})`;
          queryParams.push(documentIds);
        }

        searchQuery += `
          AND (1 - (c.embedding <=> $1::vector)) >= $${paramCount + 1}
          ORDER BY c.embedding <=> $1::vector
          LIMIT $${paramCount + 2}
        `;
        
        queryParams.push(threshold, limit);

        const result = await pool.query(searchQuery, queryParams);
        
        const results = result.rows.map(row => ({
          documentId: row.document_id,
          documentTitle: row.document_title,
          chunkText: includeChunks ? row.chunk_text : null,
          chunkIndex: row.chunk_index,
          chunkTokens: row.chunk_tokens,
          similarity: row.similarity,
          metadata: row.document_metadata
        }));

        return {
          success: true,
          query,
          results,
          resultCount: results.length,
          threshold,
          searchTime: Date.now()
        };
        
      } catch (error) {
        console.error('[EnhancedRAG] ❌ Search failed:', error.message);
        return {
          success: false,
          error: `Search failed: ${error.message}`,
          query,
          results: [],
          resultCount: 0
        };
      }
    });
  }

  /**
   * Get document list for a user
   */
  async getDocuments(userId, options = {}) {
    const {
      limit = 50,
      offset = 0,
      search = null,
      sortBy = 'created_at',
      sortOrder = 'DESC'
    } = options;

    try {
      let query = `
        SELECT 
          d.id,
          d.title,
          d.file_size,
          d.mime_type,
          d.metadata,
          d.source_type,
          d.created_at,
          d.updated_at,
          COUNT(c.id) as chunk_count
        FROM knowledge_documents d
        LEFT JOIN knowledge_chunks c ON d.id = c.document_id
        WHERE d.user_id = $1
      `;
      
      const queryParams = [userId];
      let paramCount = 1;

      if (search) {
        paramCount++;
        query += ` AND (d.title ILIKE $${paramCount} OR d.content ILIKE $${paramCount})`;
        queryParams.push(`%${search}%`);
      }

      query += ` GROUP BY d.id ORDER BY d.${sortBy} ${sortOrder} LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
      queryParams.push(limit, offset);

      const result = await pool.query(query, queryParams);
      
      return {
        success: true,
        documents: result.rows.map(row => ({
          id: row.id,
          title: row.title,
          fileSize: row.file_size,
          mimeType: row.mime_type,
          metadata: row.metadata,
          sourceType: row.source_type,
          chunkCount: parseInt(row.chunk_count),
          createdAt: row.created_at,
          updatedAt: row.updated_at
        })),
        pagination: {
          limit,
          offset,
          total: result.rowCount
        }
      };
    } catch (error) {
      console.error('[EnhancedRAG] ❌ Get documents failed:', error.message);
      return {
        success: false,
        error: `Failed to retrieve documents: ${error.message}`,
        documents: []
      };
    }
  }

  /**
   * Delete a document and its chunks
   */
  async deleteDocument(userId, documentId) {
    return OpenTelemetryTracing.traceOperation('rag.document.delete', {}, async () => {
      try {
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          
          // Verify ownership
          const docCheck = await client.query(
            'SELECT id FROM knowledge_documents WHERE id = $1 AND user_id = $2',
            [documentId, userId]
          );
          
          if (docCheck.rows.length === 0) {
            throw new Error('Document not found or access denied');
          }
          
          // Delete chunks first (foreign key constraint)
          const chunksDeleted = await client.query(
            'DELETE FROM knowledge_chunks WHERE document_id = $1',
            [documentId]
          );
          
          // Delete document
          await client.query(
            'DELETE FROM knowledge_documents WHERE id = $1',
            [documentId]
          );
          
          await client.query('COMMIT');
          
          return {
            success: true,
            documentId,
            chunksDeleted: chunksDeleted.rowCount
          };
          
        } catch (error) {
          await client.query('ROLLBACK');
          throw error;
        } finally {
          client.release();
        }
      } catch (error) {
        console.error('[EnhancedRAG] ❌ Document deletion failed:', error.message);
        throw new Error(`Document deletion failed: ${error.message}`);
      }
    });
  }

  /**
   * Get RAG system statistics
   */
  async getStats(userId) {
    try {
      const [documentsResult, chunksResult, avgSimilarityResult] = await Promise.all([
        pool.query('SELECT COUNT(*) as count, AVG(file_size) as avg_size FROM knowledge_documents WHERE user_id = $1', [userId]),
        pool.query('SELECT COUNT(*) as count, AVG(chunk_tokens) as avg_tokens FROM knowledge_chunks WHERE user_id = $1', [userId]),
        pool.query(`
          SELECT AVG(1 - (c1.embedding <=> c2.embedding)) as avg_similarity
          FROM knowledge_chunks c1
          CROSS JOIN knowledge_chunks c2
          WHERE c1.user_id = $1 AND c2.user_id = $1 AND c1.id != c2.id
          LIMIT 1000
        `, [userId])
      ]);

      return {
        success: true,
        stats: {
          documentsCount: parseInt(documentsResult.rows[0].count),
          averageDocumentSize: parseFloat(documentsResult.rows[0].avg_size) || 0,
          chunksCount: parseInt(chunksResult.rows[0].count),
          averageChunkTokens: parseFloat(chunksResult.rows[0].avg_tokens) || 0,
          averageSimilarity: parseFloat(avgSimilarityResult.rows[0].avg_similarity) || 0,
          embeddingModel: this.geminiEmbedding.modelName,
          vectorDimension: this.geminiEmbedding.vectorDimension,
          configuration: {
            chunkSize: this.config.chunkSize,
            chunkOverlap: this.config.chunkOverlap,
            similarityThreshold: this.config.similarityThreshold,
            topK: this.config.topK
          }
        }
      };
    } catch (error) {
      console.error('[EnhancedRAG] ❌ Stats failed:', error.message);
      return {
        success: false,
        error: `Failed to retrieve statistics: ${error.message}`
      };
    }
  }

  /**
   * Extract text from file buffer based on mime type
   */
  async extractTextFromBuffer(buffer, mimeType) {
    try {
      switch (mimeType) {
        case 'text/plain':
        case 'text/markdown':
        case 'text/html':
        case 'text/csv':
        case 'application/json':
          return buffer.toString('utf-8');
        
        default:
          // For unsupported types, try to extract as plain text
          return buffer.toString('utf-8');
      }
    } catch (error) {
      throw new Error(`Failed to extract text from ${mimeType}: ${error.message}`);
    }
  }

  /**
   * Get service status and configuration
   */
  getStatus() {
    return {
      initialized: this.initialized,
      enabled: this.config.enabled,
      configuration: this.config,
      geminiEmbedding: this.geminiEmbedding.getStatus(),
      supportedMimeTypes: this.supportedMimeTypes
    };
  }
}