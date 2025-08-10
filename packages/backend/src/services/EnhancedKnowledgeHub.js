/**
 * Enhanced Knowledge Hub v3.0 - Real RAG Implementation
 *
 * Transforms knowledge management from basic file storage to comprehensive RAG system:
 * - Vector embeddings with pgvector
 * - Semantic search and similarity matching
 * - Document processing and chunking
 * - Multi-modal knowledge integration
 * - AI-powered knowledge extraction
 * - Citation and source tracking
 * - Knowledge graph relationships
 */

import OpenAI from 'openai';
import pool from '../db.js';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import pdf from 'pdf-parse-fork';
import mammoth from 'mammoth';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import WolframAlphaService from './WolframAlphaService.js';

class EnhancedKnowledgeHub {
  constructor() {
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    this.wolframService = WolframAlphaService;
    this.embeddings = null; // Will store embedding model
    this.vectorDimension = 1536; // OpenAI ada-002 dimensions
    this.chunkSize = 1000;
    this.chunkOverlap = 200;

    // Knowledge processing stats
    this.processingStats = {
      documentsProcessed: 0,
      chunksCreated: 0,
      embeddingsGenerated: 0,
      searchesPerformed: 0,
      averageProcessingTime: 0,
    };

    this.textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: this.chunkSize,
      chunkOverlap: this.chunkOverlap,
      separators: ['\n\n', '\n', '. ', ' ', ''],
    });

    this.supportedFormats = [
      'text/plain',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/markdown',
      'application/json',
      'text/csv',
    ];

    console.log('[EnhancedKnowledgeHub] 🧠 Advanced RAG system initialized');
  }

  /**
   * Initialize the knowledge hub with database setup
   */
  async initialize() {
    if (process.env.LIGHTWEIGHT_TEST === '1') {
      console.log('[EnhancedKnowledgeHub] 🧪 LIGHTWEIGHT_TEST=1 -> Skipping initialization');
      return false;
    }
    try {
      await this.ensureDatabaseSchema();
      await this.testVectorOperations();
      console.log('[EnhancedKnowledgeHub] ✅ RAG system ready');
      return true;
    } catch (error) {
      console.error('[EnhancedKnowledgeHub] ❌ Initialization failed:', error);
      return false;
    }
  }

  /**
   * Ensure knowledge hub database schema exists
   */
  async ensureDatabaseSchema() {
    const schemas = [
      // Knowledge documents table
      `CREATE TABLE IF NOT EXISTS knowledge_documents (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title VARCHAR(500) NOT NULL,
        content TEXT,
        file_path VARCHAR(1000),
        file_type VARCHAR(100),
        file_size INTEGER,
        content_hash VARCHAR(64) UNIQUE,
        metadata JSONB DEFAULT '{}',
        processing_status VARCHAR(50) DEFAULT 'pending',
        processed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )`,

      // Knowledge chunks with embeddings
      `CREATE TABLE IF NOT EXISTS knowledge_chunks (
        id SERIAL PRIMARY KEY,
        document_id INTEGER NOT NULL REFERENCES knowledge_documents(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        chunk_text TEXT NOT NULL,
        chunk_index INTEGER NOT NULL,
        chunk_tokens INTEGER,
        embedding VECTOR(1536),
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW()
      )`,

      // Knowledge relationships and citations
      `CREATE TABLE IF NOT EXISTS knowledge_relationships (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        source_document_id INTEGER NOT NULL REFERENCES knowledge_documents(id) ON DELETE CASCADE,
        target_document_id INTEGER NOT NULL REFERENCES knowledge_documents(id) ON DELETE CASCADE,
        relationship_type VARCHAR(100) NOT NULL,
        similarity_score FLOAT,
        relationship_data JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(source_document_id, target_document_id, relationship_type)
      )`,

      // Knowledge queries and results
      `CREATE TABLE IF NOT EXISTS knowledge_queries (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        query_text TEXT NOT NULL,
        query_embedding VECTOR(1536),
        search_type VARCHAR(50) DEFAULT 'semantic',
        results_count INTEGER DEFAULT 0,
        response_generated TEXT,
        processing_time_ms INTEGER,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )`,

      // Knowledge extraction results
      `CREATE TABLE IF NOT EXISTS knowledge_extractions (
        id SERIAL PRIMARY KEY,
        document_id INTEGER NOT NULL REFERENCES knowledge_documents(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        extraction_type VARCHAR(100) NOT NULL,
        extracted_data JSONB NOT NULL,
        confidence_score FLOAT,
        extraction_method VARCHAR(100),
        created_at TIMESTAMPTZ DEFAULT NOW()
      )`,
    ];

    for (const schema of schemas) {
      await pool.query(schema);
    }

    // Create indexes for performance
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_embedding ON knowledge_chunks USING ivfflat (embedding vector_cosine_ops)',
      'CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_document ON knowledge_chunks(document_id, chunk_index)',
      'CREATE INDEX IF NOT EXISTS idx_knowledge_documents_user ON knowledge_documents(user_id, created_at)',
      'CREATE INDEX IF NOT EXISTS idx_knowledge_documents_hash ON knowledge_documents(content_hash)',
      'CREATE INDEX IF NOT EXISTS idx_knowledge_queries_user ON knowledge_queries(user_id, created_at)',
      'CREATE INDEX IF NOT EXISTS idx_knowledge_relationships_source ON knowledge_relationships(source_document_id)',
      'CREATE INDEX IF NOT EXISTS idx_knowledge_extractions_document ON knowledge_extractions(document_id, extraction_type)',
    ];

    for (const index of indexes) {
      try {
        await pool.query(index);
      } catch (error) {
        console.warn(
          `[EnhancedKnowledgeHub] Index creation warning:`,
          error.message
        );
      }
    }
  }

  /**
   * Test vector operations
   */
  async testVectorOperations() {
    try {
      // Test embedding generation
      const testEmbedding = await this.generateEmbedding('test document');
      console.log(
        `[EnhancedKnowledgeHub] ✅ Vector operations test passed (${testEmbedding.length} dimensions)`
      );
    } catch (error) {
      console.error(
        '[EnhancedKnowledgeHub] ❌ Vector operations test failed:',
        error
      );
      throw error;
    }
  }

  /**
   * Process and store a document with full RAG pipeline
   */
  async processDocument(userId, fileInfo, filePath, metadata = {}) {
    const startTime = Date.now();

    try {
      console.log(
        `[EnhancedKnowledgeHub] 📄 Processing document: ${fileInfo.originalname}`
      );

      // Read and extract content
      const content = await this.extractTextContent(
        filePath,
        fileInfo.mimetype
      );

      // Generate content hash for deduplication
      const contentHash = this.generateContentHash(content);

      // Check for existing document
      const existingDoc = await pool.query(
        'SELECT id FROM knowledge_documents WHERE content_hash = $1',
        [contentHash]
      );

      if (existingDoc.rows.length > 0) {
        console.log('[EnhancedKnowledgeHub] ⚠️ Document already exists');
        return {
          success: false,
          message: 'Document with identical content already exists',
          documentId: existingDoc.rows[0].id,
        };
      }

      // Store document
      const documentResult = await pool.query(
        `INSERT INTO knowledge_documents 
         (user_id, title, content, file_path, file_type, file_size, content_hash, metadata, processing_status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'processing')
         RETURNING id`,
        [
          userId,
          fileInfo.originalname,
          content,
          filePath,
          fileInfo.mimetype,
          fileInfo.size,
          contentHash,
          JSON.stringify(metadata),
        ]
      );

      const documentId = documentResult.rows[0].id;

      // Process document asynchronously
      this.processDocumentAsync(documentId, userId, content, fileInfo);

      const processingTime = Date.now() - startTime;
      this.updateProcessingStats(true, processingTime);

      return {
        success: true,
        documentId,
        contentHash,
        processingTime,
        status: 'processing',
      };
    } catch (error) {
      console.error(
        '[EnhancedKnowledgeHub] ❌ Document processing failed:',
        error
      );
      const processingTime = Date.now() - startTime;
      this.updateProcessingStats(false, processingTime);

      throw error;
    }
  }

  /**
   * Asynchronously process document chunks and embeddings
   */
  async processDocumentAsync(documentId, userId, content, fileInfo) {
    try {
      console.log(
        `[EnhancedKnowledgeHub] 🔄 Creating chunks for document ${documentId}`
      );

      // Split content into chunks
      const chunks = await this.textSplitter.splitText(content);

      // Process chunks in batches to avoid rate limits
      const batchSize = 10;
      for (let i = 0; i < chunks.length; i += batchSize) {
        const batch = chunks.slice(i, i + batchSize);
        await this.processChunkBatch(documentId, userId, batch, i);

        // Small delay to respect rate limits
        await this.delay(100);
      }

      // Extract structured knowledge
      await this.extractStructuredKnowledge(
        documentId,
        userId,
        content,
        fileInfo
      );

      // Find related documents
      await this.findDocumentRelationships(documentId, userId);

      // Update document status
      await pool.query(
        'UPDATE knowledge_documents SET processing_status = $1, processed_at = NOW() WHERE id = $2',
        ['completed', documentId]
      );

      this.processingStats.documentsProcessed++;
      console.log(
        `[EnhancedKnowledgeHub] ✅ Document ${documentId} processing completed`
      );
    } catch (error) {
      console.error(
        `[EnhancedKnowledgeHub] ❌ Async processing failed for document ${documentId}:`,
        error
      );

      await pool.query(
        'UPDATE knowledge_documents SET processing_status = $1 WHERE id = $2',
        ['failed', documentId]
      );
    }
  }

  /**
   * Process a batch of chunks
   */
  async processChunkBatch(documentId, userId, chunks, startIndex) {
    const chunkPromises = chunks.map(async (chunkText, batchIndex) => {
      const chunkIndex = startIndex + batchIndex;

      try {
        // Generate embedding
        const embedding = await this.generateEmbedding(chunkText);

        // Count tokens (approximate)
        const tokenCount = Math.ceil(chunkText.length / 4);

        // Store chunk with embedding
        await pool.query(
          `INSERT INTO knowledge_chunks 
           (document_id, user_id, chunk_text, chunk_index, chunk_tokens, embedding, metadata)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            documentId,
            userId,
            chunkText,
            chunkIndex,
            tokenCount,
            JSON.stringify(embedding),
            JSON.stringify({ processed_at: new Date().toISOString() }),
          ]
        );

        this.processingStats.chunksCreated++;
        this.processingStats.embeddingsGenerated++;
      } catch (error) {
        console.error(
          `[EnhancedKnowledgeHub] ❌ Chunk processing failed:`,
          error
        );
        throw error;
      }
    });

    await Promise.all(chunkPromises);
  }

  /**
   * Extract text content from various file formats
   */
  async extractTextContent(filePath, mimeType) {
    try {
      switch (mimeType) {
        case 'text/plain':
        case 'text/markdown':
          return await fs.readFile(filePath, 'utf-8');

        case 'application/pdf':
          const pdfBuffer = await fs.readFile(filePath);
          const pdfData = await pdf(pdfBuffer);
          return pdfData.text;

        case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
          const docxBuffer = await fs.readFile(filePath);
          const docxResult = await mammoth.extractRawText({
            buffer: docxBuffer,
          });
          return docxResult.value;

        case 'application/json':
          const jsonContent = await fs.readFile(filePath, 'utf-8');
          const jsonData = JSON.parse(jsonContent);
          return JSON.stringify(jsonData, null, 2);

        case 'text/csv':
          return await fs.readFile(filePath, 'utf-8');

        default:
          // Try to read as text
          return await fs.readFile(filePath, 'utf-8');
      }
    } catch (error) {
      console.error(
        '[EnhancedKnowledgeHub] ❌ Content extraction failed:',
        error
      );
      throw new Error(
        `Failed to extract content from ${mimeType}: ${error.message}`
      );
    }
  }

  /**
   * Generate embedding for text
   */
  async generateEmbedding(text) {
    try {
      const response = await this.openai.embeddings.create({
        model: 'text-embedding-ada-002',
        input: text.substring(0, 8000), // OpenAI limit
      });

      return response.data[0].embedding;
    } catch (error) {
      console.error(
        '[EnhancedKnowledgeHub] ❌ Embedding generation failed:',
        error
      );
      throw error;
    }
  }

  /**
   * Perform semantic search across knowledge base
   */
  async semanticSearch(userId, query, options = {}) {
    const startTime = Date.now();

    try {
      console.log(
        `[EnhancedKnowledgeHub] 🔍 Semantic search: "${query.substring(
          0,
          100
        )}..."`
      );

      const {
        limit = 10,
        threshold = 0.7,
        includeChunks = true,
        includeDocuments = true,
        documentIds = null,
      } = options;

      // Generate query embedding
      const queryEmbedding = await this.generateEmbedding(query);

      // Store query for analytics
      const queryResult = await pool.query(
        `INSERT INTO knowledge_queries (user_id, query_text, query_embedding, search_type)
         VALUES ($1, $2, $3, 'semantic') RETURNING id`,
        [userId, query, JSON.stringify(queryEmbedding)]
      );

      const queryId = queryResult.rows[0].id;

      // Build search query
      let searchQuery = `
        SELECT 
          kc.id as chunk_id,
          kc.chunk_text,
          kc.chunk_index,
          kd.id as document_id,
          kd.title as document_title,
          kd.file_type,
          kd.metadata as document_metadata,
          1 - (kc.embedding <=> $2::vector) as similarity
        FROM knowledge_chunks kc
        JOIN knowledge_documents kd ON kc.document_id = kd.id
        WHERE kc.user_id = $1 
          AND kd.processing_status = 'completed'
          AND 1 - (kc.embedding <=> $2::vector) >= $3
      `;

      const params = [userId, JSON.stringify(queryEmbedding), threshold];

      // Add document filter if specified
      if (documentIds && documentIds.length > 0) {
        searchQuery += ` AND kd.id = ANY($${params.length + 1})`;
        params.push(documentIds);
      }

      searchQuery += `
        ORDER BY similarity DESC
        LIMIT $${params.length + 1}
      `;
      params.push(limit);

      const searchResult = await pool.query(searchQuery, params);

      // Update query with results count
      await pool.query(
        'UPDATE knowledge_queries SET results_count = $1, processing_time_ms = $2 WHERE id = $3',
        [searchResult.rows.length, Date.now() - startTime, queryId]
      );

      this.processingStats.searchesPerformed++;

      return {
        success: true,
        query,
        results: searchResult.rows,
        resultCount: searchResult.rows.length,
        processingTime: Date.now() - startTime,
        queryId,
      };
    } catch (error) {
      console.error('[EnhancedKnowledgeHub] ❌ Semantic search failed:', error);
      return {
        success: false,
        error: error.message,
        processingTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Generate AI-powered answer from search results
   */
  async generateRAGResponse(userId, query, searchResults, options = {}) {
    try {
      const {
        model = 'gpt-4o',
        maxTokens = 1000,
        includeReferences = true,
      } = options;

      if (!searchResults || searchResults.length === 0) {
        return {
          success: false,
          message: 'No relevant documents found for query',
        };
      }

      // Prepare context from search results
      const context = searchResults
        .map((result, index) => {
          return `[${index + 1}] ${result.document_title}\n${
            result.chunk_text
          }\n`;
        })
        .join('\n---\n\n');

      // Create RAG prompt
      const ragPrompt = `Based on the following context from the user's knowledge base, please provide a comprehensive and accurate answer to their question.

CONTEXT:
${context}

USER QUESTION: ${query}

Please provide a detailed answer based on the context above. If you use information from the context, please reference the source by using the numbers in brackets [1], [2], etc.

ANSWER:`;

      // Generate response
      const completion = await this.openai.chat.completions.create({
        model,
        messages: [
          {
            role: 'system',
            content:
              'You are a helpful AI assistant that answers questions based on provided context. Always cite your sources when using information from the context.',
          },
          { role: 'user', content: ragPrompt },
        ],
        max_tokens: maxTokens,
        temperature: 0.3,
      });

      const response = completion.choices[0].message.content;

      // Prepare references if requested
      const references = includeReferences
        ? searchResults.map((result, index) => ({
            index: index + 1,
            document_title: result.document_title,
            document_id: result.document_id,
            similarity: result.similarity,
            chunk_text: result.chunk_text.substring(0, 200) + '...',
          }))
        : [];

      return {
        success: true,
        response,
        references,
        model,
        contextLength: context.length,
        tokenUsage: completion.usage,
      };
    } catch (error) {
      console.error(
        '[EnhancedKnowledgeHub] ❌ RAG response generation failed:',
        error
      );
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Extract structured knowledge using AI
   */
  async extractStructuredKnowledge(documentId, userId, content, fileInfo) {
    try {
      console.log(
        `[EnhancedKnowledgeHub] 🧠 Extracting structured knowledge from document ${documentId}`
      );

      // Extract key concepts and entities
      const concepts = await this.extractKeyConcepts(content);

      // Extract factual information using Wolfram Alpha for validation
      const facts = await this.extractFactualInformation(content);

      // Store extractions
      const extractions = [
        {
          type: 'key_concepts',
          data: concepts,
          method: 'gpt_extraction',
        },
        {
          type: 'factual_information',
          data: facts,
          method: 'ai_analysis_wolfram_validation',
        },
      ];

      for (const extraction of extractions) {
        await pool.query(
          `INSERT INTO knowledge_extractions 
           (document_id, user_id, extraction_type, extracted_data, extraction_method, confidence_score)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            documentId,
            userId,
            extraction.type,
            JSON.stringify(extraction.data),
            extraction.method,
            0.85, // Default confidence
          ]
        );
      }

      console.log(
        `[EnhancedKnowledgeHub] ✅ Structured knowledge extracted for document ${documentId}`
      );
    } catch (error) {
      console.error(
        `[EnhancedKnowledgeHub] ❌ Knowledge extraction failed for document ${documentId}:`,
        error
      );
    }
  }

  /**
   * Extract key concepts from text
   */
  async extractKeyConcepts(text) {
    try {
      const prompt = `Analyze the following text and extract key concepts, entities, and important information. 
      
Return a JSON object with the following structure:
{
  "main_topics": ["topic1", "topic2", "..."],
  "entities": {
    "people": ["name1", "name2"],
    "organizations": ["org1", "org2"],
    "locations": ["place1", "place2"],
    "technologies": ["tech1", "tech2"]
  },
  "key_facts": ["fact1", "fact2", "..."],
  "summary": "Brief summary of the content"
}

TEXT:
${text.substring(0, 4000)}`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content:
              'You are an expert at extracting structured information from text. Always return valid JSON.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.1,
      });

      const result = JSON.parse(response.choices[0].message.content);
      return result;
    } catch (error) {
      console.error(
        '[EnhancedKnowledgeHub] ❌ Key concept extraction failed:',
        error
      );
      return { error: error.message };
    }
  }

  /**
   * Extract and validate factual information
   */
  async extractFactualInformation(text) {
    try {
      // First extract potential facts with AI
      const factExtractionPrompt = `Extract factual statements, numbers, dates, and claims from this text that could be verified:

TEXT: ${text.substring(0, 3000)}

Return a JSON array of facts, each with:
{
  "statement": "the factual claim",
  "type": "statistic|date|scientific_fact|historical_event|mathematical_formula|other",
  "verifiable": true/false
}`;

      const extraction = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content:
              'Extract verifiable factual information from text. Return valid JSON array.',
          },
          { role: 'user', content: factExtractionPrompt },
        ],
        temperature: 0.1,
      });

      const extractedFacts = JSON.parse(extraction.choices[0].message.content);

      // Validate some facts with Wolfram Alpha
      const validatedFacts = [];
      for (const fact of extractedFacts.slice(0, 3)) {
        // Limit to avoid rate limits
        if (
          fact.verifiable &&
          (fact.type === 'scientific_fact' ||
            fact.type === 'mathematical_formula' ||
            fact.type === 'statistic')
        ) {
          try {
            const wolframResult = await this.wolframService.query(
              fact.statement
            );
            validatedFacts.push({
              ...fact,
              wolfram_verification: {
                verified: wolframResult.success,
                wolfram_result:
                  wolframResult.summary || wolframResult.plaintext?.[0],
              },
            });
          } catch (wolframError) {
            validatedFacts.push({
              ...fact,
              wolfram_verification: {
                verified: false,
                error: 'Wolfram query failed',
              },
            });
          }
        } else {
          validatedFacts.push(fact);
        }
      }

      return {
        extracted_facts: extractedFacts,
        validated_facts: validatedFacts,
        validation_count: validatedFacts.filter(
          f => f.wolfram_verification?.verified
        ).length,
      };
    } catch (error) {
      console.error(
        '[EnhancedKnowledgeHub] ❌ Factual information extraction failed:',
        error
      );
      return { error: error.message };
    }
  }

  /**
   * Find relationships between documents
   */
  async findDocumentRelationships(documentId, userId) {
    try {
      // Get document chunks
      const chunksResult = await pool.query(
        'SELECT chunk_text, embedding FROM knowledge_chunks WHERE document_id = $1 LIMIT 5',
        [documentId]
      );

      if (chunksResult.rows.length === 0) return;

      // Find similar documents based on chunk similarity
      const similarDocsQuery = `
        WITH doc_similarities AS (
          SELECT 
            kd.id as related_doc_id,
            kd.title,
            AVG(1 - (kc1.embedding <=> kc2.embedding)) as avg_similarity
          FROM knowledge_chunks kc1
          CROSS JOIN knowledge_chunks kc2
          JOIN knowledge_documents kd ON kc2.document_id = kd.id
          WHERE kc1.document_id = $1 
            AND kc2.document_id != $1
            AND kc2.user_id = $2
            AND kd.processing_status = 'completed'
          GROUP BY kd.id, kd.title
          HAVING AVG(1 - (kc1.embedding <=> kc2.embedding)) >= 0.8
        )
        SELECT * FROM doc_similarities
        ORDER BY avg_similarity DESC
        LIMIT 5
      `;

      const similarDocs = await pool.query(similarDocsQuery, [
        documentId,
        userId,
      ]);

      // Store relationships
      for (const similar of similarDocs.rows) {
        await pool.query(
          `INSERT INTO knowledge_relationships 
           (user_id, source_document_id, target_document_id, relationship_type, similarity_score)
           VALUES ($1, $2, $3, 'semantic_similarity', $4)
           ON CONFLICT (source_document_id, target_document_id, relationship_type) 
           DO UPDATE SET similarity_score = EXCLUDED.similarity_score`,
          [userId, documentId, similar.related_doc_id, similar.avg_similarity]
        );
      }
    } catch (error) {
      console.error(
        `[EnhancedKnowledgeHub] ❌ Relationship finding failed for document ${documentId}:`,
        error
      );
    }
  }

  /**
   * Get comprehensive knowledge analytics
   */
  async getKnowledgeAnalytics(userId) {
    try {
      const analytics = {};

      // Document statistics
      const docStats = await pool.query(
        `
        SELECT 
          COUNT(*) as total_documents,
          COUNT(CASE WHEN processing_status = 'completed' THEN 1 END) as processed_documents,
          COUNT(CASE WHEN processing_status = 'processing' THEN 1 END) as processing_documents,
          COUNT(CASE WHEN processing_status = 'failed' THEN 1 END) as failed_documents,
          SUM(file_size) as total_size_bytes,
          COUNT(DISTINCT file_type) as unique_file_types
        FROM knowledge_documents 
        WHERE user_id = $1
      `,
        [userId]
      );

      analytics.documents = docStats.rows[0];

      // Chunk statistics
      const chunkStats = await pool.query(
        `
        SELECT 
          COUNT(*) as total_chunks,
          AVG(chunk_tokens) as avg_chunk_tokens,
          SUM(chunk_tokens) as total_tokens
        FROM knowledge_chunks 
        WHERE user_id = $1
      `,
        [userId]
      );

      analytics.chunks = chunkStats.rows[0];

      // Search statistics
      const searchStats = await pool.query(
        `
        SELECT 
          COUNT(*) as total_searches,
          AVG(results_count) as avg_results_per_search,
          AVG(processing_time_ms) as avg_search_time_ms
        FROM knowledge_queries 
        WHERE user_id = $1 
          AND created_at >= NOW() - INTERVAL '30 days'
      `,
        [userId]
      );

      analytics.searches = searchStats.rows[0];

      // Knowledge extractions
      const extractionStats = await pool.query(
        `
        SELECT 
          extraction_type,
          COUNT(*) as count,
          AVG(confidence_score) as avg_confidence
        FROM knowledge_extractions 
        WHERE user_id = $1
        GROUP BY extraction_type
      `,
        [userId]
      );

      analytics.extractions = extractionStats.rows;

      // Top document relationships
      const relationships = await pool.query(
        `
        SELECT 
          kd1.title as source_title,
          kd2.title as target_title,
          kr.relationship_type,
          kr.similarity_score
        FROM knowledge_relationships kr
        JOIN knowledge_documents kd1 ON kr.source_document_id = kd1.id
        JOIN knowledge_documents kd2 ON kr.target_document_id = kd2.id
        WHERE kr.user_id = $1
        ORDER BY kr.similarity_score DESC
        LIMIT 10
      `,
        [userId]
      );

      analytics.relationships = relationships.rows;

      return {
        success: true,
        analytics,
        system_stats: this.processingStats,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error(
        '[EnhancedKnowledgeHub] ❌ Analytics generation failed:',
        error
      );
      return { success: false, error: error.message };
    }
  }

  // Utility methods
  generateContentHash(content) {
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  updateProcessingStats(success, processingTime) {
    if (success) {
      // Update rolling average
      const currentAvg = this.processingStats.averageProcessingTime;
      const total = this.processingStats.documentsProcessed + 1;
      this.processingStats.averageProcessingTime =
        (currentAvg * this.processingStats.documentsProcessed +
          processingTime) /
        total;
    }
  }

  /**
   * Get processing status and statistics
   */
  getStatus() {
    return {
      service: 'EnhancedKnowledgeHub',
      version: '3.0',
      supported_formats: this.supportedFormats,
      vector_dimension: this.vectorDimension,
      chunk_config: {
        size: this.chunkSize,
        overlap: this.chunkOverlap,
      },
      processing_stats: this.processingStats,
      timestamp: new Date().toISOString(),
    };
  }
}

export default EnhancedKnowledgeHub;
