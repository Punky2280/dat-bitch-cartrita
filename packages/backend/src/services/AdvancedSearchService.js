/**
 * Advanced Search & Knowledge Retrieval Service
 * 
 * Unified search engine combining multiple search strategies:
 * - Vector similarity search (semantic)
 * - Full-text search with PostgreSQL
 * - Knowledge graph traversal
 * - Multi-modal search (text, code, documents)
 * - Composite scoring and ranking
 * - Advanced filtering and faceting
 * - Search analytics and optimization
 * 
 * @author Robbie Allen - Lead Architect  
 * @date January 2025
 */

import { OpenAI } from 'openai';
import pkg from 'pg';
import natural from 'natural';
import similarity from 'string-similarity';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { traceOperation } from '../system/OpenTelemetryTracing.js';
import db from '../db.js';

const { Pool } = pkg;
const { TfIdf, PorterStemmer, WordTokenizer, SentimentAnalyzer, PorterStemmerRu } = natural;

class AdvancedSearchService {
  constructor() {
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    this.pool = db;
    
    // Search configuration
    this.config = {
      maxResults: 100,
      defaultThreshold: 0.1,
      semanticWeight: 0.4,
      textWeight: 0.3,
      graphWeight: 0.2,
      popularityWeight: 0.1,
      embeddingModel: 'text-embedding-3-large',
      embeddingDimensions: 3072,
      chunkSize: 1000,
      chunkOverlap: 200,
    };

    // Initialize text processing tools
    this.tokenizer = new WordTokenizer();
    this.stemmer = PorterStemmer;
    this.tfidf = new TfIdf();
    this.textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: this.config.chunkSize,
      chunkOverlap: this.config.chunkOverlap,
    });

    // Search analytics
    this.analytics = {
      totalSearches: 0,
      avgResponseTime: 0,
      popularQueries: new Map(),
      searchPatterns: new Map(),
    };

    // Search indexes
    this.searchIndexes = {
      knowledge: new Map(),
      conversations: new Map(),
      workflows: new Map(),
      documents: new Map(),
    };

    // Initialize the service
    this.initialize();
  }

  /**
   * Initialize the advanced search service
   */
  async initialize() {
    try {
      console.log('[AdvancedSearch] 🔍 Initializing advanced search service...');
      
      // Build search indexes
      await this.buildSearchIndexes();
      
      // Test search capabilities
      await this.testSearchCapabilities();
      
      console.log('[AdvancedSearch] ✅ Advanced search service ready');
    } catch (error) {
      console.error('[AdvancedSearch] ❌ Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Build comprehensive search indexes
   */
  async buildSearchIndexes() {
    return traceOperation('advanced.search.build_indexes', async (span) => {
      try {
        console.log('[AdvancedSearch] 📚 Building search indexes...');
        
        // Build knowledge index from multiple sources
        await this.buildKnowledgeIndex();
        
        // Build conversation index
        await this.buildConversationIndex();
        
        // Build workflow index
        await this.buildWorkflowIndex();
        
        // Build document index
        await this.buildDocumentIndex();
        
        span.setAttributes({
          'indexes.knowledge_entries': this.searchIndexes.knowledge.size,
          'indexes.conversation_entries': this.searchIndexes.conversations.size,
          'indexes.workflow_entries': this.searchIndexes.workflows.size,
          'indexes.document_entries': this.searchIndexes.documents.size,
        });
        
        console.log('[AdvancedSearch] ✅ Search indexes built successfully');
      } catch (error) {
        console.error('[AdvancedSearch] ❌ Index building failed:', error);
        span.recordException(error);
        throw error;
      }
    });
  }

  /**
   * Build knowledge base search index
   */
  async buildKnowledgeIndex() {
    try {
      // Index knowledge entries
      const entriesQuery = `
        SELECT 
          id, title, content, category, tags, 
          content_embedding, title_embedding,
          importance_score, user_id, created_at
        FROM knowledge_entries 
        WHERE content_embedding IS NOT NULL
        LIMIT 10000
      `;
      
      const entriesResult = await this.pool.query(entriesQuery);
      
      for (const entry of entriesResult.rows) {
        const searchableContent = `${entry.title} ${entry.content}`;
        const tokens = this.tokenizer.tokenize(searchableContent.toLowerCase());
        const stemmedTokens = tokens.map(token => this.stemmer.stem(token));
        
        this.searchIndexes.knowledge.set(entry.id, {
          id: entry.id,
          type: 'knowledge_entry',
          title: entry.title,
          content: entry.content,
          category: entry.category,
          tags: entry.tags || [],
          tokens: stemmedTokens,
          embedding: entry.content_embedding,
          titleEmbedding: entry.title_embedding,
          score: entry.importance_score || 0,
          userId: entry.user_id,
          timestamp: entry.created_at,
        });
      }

      // Index knowledge documents and chunks
      const chunksQuery = `
        SELECT 
          kc.id, kc.chunk_text, kc.chunk_index,
          kd.id as document_id, kd.title as document_title,
          kd.file_type, kd.metadata, kc.embedding,
          kd.user_id, kc.created_at
        FROM knowledge_chunks kc
        JOIN knowledge_documents kd ON kc.document_id = kd.id
        WHERE kc.embedding IS NOT NULL 
          AND kd.processing_status = 'completed'
        LIMIT 5000
      `;
      
      const chunksResult = await this.pool.query(chunksQuery);
      
      for (const chunk of chunksResult.rows) {
        const tokens = this.tokenizer.tokenize(chunk.chunk_text.toLowerCase());
        const stemmedTokens = tokens.map(token => this.stemmer.stem(token));
        
        this.searchIndexes.knowledge.set(`chunk_${chunk.id}`, {
          id: chunk.id,
          type: 'knowledge_chunk',
          title: chunk.document_title,
          content: chunk.chunk_text,
          documentId: chunk.document_id,
          chunkIndex: chunk.chunk_index,
          fileType: chunk.file_type,
          metadata: chunk.metadata,
          tokens: stemmedTokens,
          embedding: chunk.embedding,
          score: 0.8,
          userId: chunk.user_id,
          timestamp: chunk.created_at,
        });
      }

      console.log(`[AdvancedSearch] 📚 Indexed ${this.searchIndexes.knowledge.size} knowledge items`);
    } catch (error) {
      console.error('[AdvancedSearch] ❌ Knowledge index building failed:', error);
    }
  }

  /**
   * Build conversation search index
   */
  async buildConversationIndex() {
    try {
      const conversationQuery = `
        SELECT 
          cm.id, cm.content, cm.role, cm.metadata,
          c.title, c.user_id, cm.created_at
        FROM conversation_messages cm
        JOIN conversations c ON cm.conversation_id = c.id
        WHERE LENGTH(cm.content) > 10
        ORDER BY cm.created_at DESC
        LIMIT 5000
      `;
      
      const result = await this.pool.query(conversationQuery);
      
      for (const msg of result.rows) {
        const searchableContent = `${msg.content}`;
        const tokens = this.tokenizer.tokenize(searchableContent.toLowerCase());
        const stemmedTokens = tokens.map(token => this.stemmer.stem(token));
        
        this.searchIndexes.conversations.set(msg.id, {
          id: msg.id,
          type: 'conversation_message',
          title: msg.title || 'Conversation',
          content: msg.content,
          role: msg.role,
          metadata: msg.metadata,
          tokens: stemmedTokens,
          score: msg.role === 'assistant' ? 0.9 : 0.7,
          userId: msg.user_id,
          timestamp: msg.created_at,
        });
      }

      console.log(`[AdvancedSearch] 💬 Indexed ${this.searchIndexes.conversations.size} conversation messages`);
    } catch (error) {
      console.error('[AdvancedSearch] ❌ Conversation index building failed:', error);
    }
  }

  /**
   * Build workflow search index
   */
  async buildWorkflowIndex() {
    try {
      const workflowQuery = `
        SELECT 
          id, name, description, configuration, 
          is_active, user_id, created_at
        FROM workflows
        WHERE is_active = true
        LIMIT 1000
      `;
      
      const result = await this.pool.query(workflowQuery);
      
      for (const workflow of result.rows) {
        const searchableContent = `${workflow.name} ${workflow.description || ''}`;
        const tokens = this.tokenizer.tokenize(searchableContent.toLowerCase());
        const stemmedTokens = tokens.map(token => this.stemmer.stem(token));
        
        this.searchIndexes.workflows.set(workflow.id, {
          id: workflow.id,
          type: 'workflow',
          title: workflow.name,
          content: workflow.description || '',
          configuration: workflow.configuration,
          tokens: stemmedTokens,
          score: 0.8,
          userId: workflow.user_id,
          timestamp: workflow.created_at,
        });
      }

      console.log(`[AdvancedSearch] 🔧 Indexed ${this.searchIndexes.workflows.size} workflows`);
    } catch (error) {
      console.error('[AdvancedSearch] ❌ Workflow index building failed:', error);
    }
  }

  /**
   * Build document search index
   */
  async buildDocumentIndex() {
    try {
      // This will be extended based on document storage implementation
      console.log('[AdvancedSearch] 📄 Document index placeholder ready');
    } catch (error) {
      console.error('[AdvancedSearch] ❌ Document index building failed:', error);
    }
  }

  /**
   * Perform unified advanced search
   */
  async search(query, options = {}) {
    const startTime = Date.now();
    
    return traceOperation('advanced.search.unified', async (span) => {
      try {
        const {
          userId,
          searchTypes = ['semantic', 'fulltext', 'graph'],
          sources = ['knowledge', 'conversations', 'workflows'],
          limit = 20,
          threshold = this.config.defaultThreshold,
          filters = {},
          facets = [],
          explain = false,
        } = options;

        console.log(`[AdvancedSearch] 🔍 Unified search: "${query}"`);

        const searchResults = {
          query,
          results: [],
          facets: {},
          analytics: {
            totalMatches: 0,
            searchTime: 0,
            strategy: 'unified',
            confidence: 0,
          },
          explanation: explain ? [] : undefined,
        };

        // Generate query embedding for semantic search
        let queryEmbedding = null;
        if (searchTypes.includes('semantic')) {
          queryEmbedding = await this.generateEmbedding(query);
        }

        // Perform searches across different strategies
        const searchPromises = [];

        if (searchTypes.includes('semantic')) {
          searchPromises.push(this.performSemanticSearch(query, queryEmbedding, options));
        }

        if (searchTypes.includes('fulltext')) {
          searchPromises.push(this.performFullTextSearch(query, options));
        }

        if (searchTypes.includes('graph')) {
          searchPromises.push(this.performGraphSearch(query, options));
        }

        // Execute all searches in parallel
        const searchResultSets = await Promise.all(searchPromises);

        // Combine and rank results
        const combinedResults = this.combineSearchResults(searchResultSets, options);

        // Apply advanced filtering
        const filteredResults = this.applyAdvancedFilters(combinedResults, filters);

        // Generate facets
        if (facets.length > 0) {
          searchResults.facets = this.generateFacets(filteredResults, facets);
        }

        // Final ranking and limiting
        searchResults.results = this.rankAndLimitResults(filteredResults, limit);

        // Update analytics
        searchResults.analytics.totalMatches = searchResults.results.length;
        searchResults.analytics.searchTime = Date.now() - startTime;
        searchResults.analytics.confidence = this.calculateSearchConfidence(searchResults.results);

        // Log search for analytics
        this.logSearch(query, searchResults, userId);

        span.setAttributes({
          'search.query': query,
          'search.results_count': searchResults.results.length,
          'search.duration_ms': searchResults.analytics.searchTime,
          'search.types': searchTypes.join(','),
          'search.sources': sources.join(','),
        });

        return {
          success: true,
          ...searchResults,
        };

      } catch (error) {
        console.error('[AdvancedSearch] ❌ Unified search failed:', error);
        span.recordException(error);
        
        return {
          success: false,
          error: error.message,
          searchTime: Date.now() - startTime,
        };
      }
    });
  }

  /**
   * Perform semantic search using vector embeddings
   */
  async performSemanticSearch(query, queryEmbedding, options = {}) {
    return traceOperation('advanced.search.semantic', async (span) => {
      try {
        const { sources = ['knowledge'], limit = 50, threshold = 0.1, userId } = options;
        const results = [];

        // Search knowledge base
        if (sources.includes('knowledge')) {
          const knowledgeQuery = `
            SELECT 
              'knowledge_entry' as type,
              id, title, content, category, tags,
              1 - (content_embedding <=> $1::vector) as similarity,
              importance_score, user_id
            FROM knowledge_entries 
            WHERE content_embedding IS NOT NULL
              AND 1 - (content_embedding <=> $1::vector) >= $2
              ${userId ? 'AND user_id = $3' : ''}
            ORDER BY content_embedding <=> $1::vector
            LIMIT $${userId ? '4' : '3'}
          `;

          const params = [JSON.stringify(queryEmbedding), threshold];
          if (userId) params.push(userId);
          params.push(limit);

          const knowledgeResult = await this.pool.query(knowledgeQuery, params);
          
          for (const row of knowledgeResult.rows) {
            results.push({
              id: row.id,
              type: row.type,
              title: row.title,
              content: row.content,
              category: row.category,
              tags: row.tags || [],
              score: row.similarity * this.config.semanticWeight + 
                     row.importance_score * this.config.popularityWeight,
              similarity: row.similarity,
              searchType: 'semantic',
              source: 'knowledge',
              userId: row.user_id,
            });
          }

          // Search knowledge chunks
          const chunkQuery = `
            SELECT 
              'knowledge_chunk' as type,
              kc.id, kd.title, kc.chunk_text as content,
              kd.file_type as category, kc.chunk_index,
              1 - (kc.embedding <=> $1::vector) as similarity,
              kd.user_id
            FROM knowledge_chunks kc
            JOIN knowledge_documents kd ON kc.document_id = kd.id
            WHERE kc.embedding IS NOT NULL
              AND 1 - (kc.embedding <=> $1::vector) >= $2
              ${userId ? 'AND kd.user_id = $3' : ''}
            ORDER BY kc.embedding <=> $1::vector
            LIMIT $${userId ? '4' : '3'}
          `;

          const chunkParams = [JSON.stringify(queryEmbedding), threshold];
          if (userId) chunkParams.push(userId);
          chunkParams.push(limit);

          const chunkResult = await this.pool.query(chunkQuery, chunkParams);
          
          for (const row of chunkResult.rows) {
            results.push({
              id: `chunk_${row.id}`,
              type: row.type,
              title: row.title,
              content: row.content,
              category: row.category,
              chunkIndex: row.chunk_index,
              score: row.similarity * this.config.semanticWeight,
              similarity: row.similarity,
              searchType: 'semantic',
              source: 'knowledge_chunks',
              userId: row.user_id,
            });
          }
        }

        span.setAttributes({
          'semantic.results_count': results.length,
          'semantic.avg_similarity': results.length > 0 
            ? results.reduce((sum, r) => sum + r.similarity, 0) / results.length 
            : 0,
        });

        return results;
      } catch (error) {
        console.error('[AdvancedSearch] ❌ Semantic search failed:', error);
        span.recordException(error);
        return [];
      }
    });
  }

  /**
   * Perform full-text search using PostgreSQL
   */
  async performFullTextSearch(query, options = {}) {
    return traceOperation('advanced.search.fulltext', async (span) => {
      try {
        const { sources = ['knowledge'], limit = 50, userId } = options;
        const results = [];

        // Search knowledge entries
        if (sources.includes('knowledge')) {
          const knowledgeQuery = `
            SELECT 
              'knowledge_entry' as type,
              id, title, content, category, tags,
              ts_rank(
                to_tsvector('english', title || ' ' || content),
                plainto_tsquery('english', $1)
              ) as relevance,
              importance_score, user_id
            FROM knowledge_entries 
            WHERE to_tsvector('english', title || ' ' || content) @@ plainto_tsquery('english', $1)
              ${userId ? 'AND user_id = $2' : ''}
            ORDER BY relevance DESC, importance_score DESC
            LIMIT $${userId ? '3' : '2'}
          `;

          const params = [query];
          if (userId) params.push(userId);
          params.push(limit);

          const knowledgeResult = await this.pool.query(knowledgeQuery, params);
          
          for (const row of knowledgeResult.rows) {
            results.push({
              id: row.id,
              type: row.type,
              title: row.title,
              content: row.content,
              category: row.category,
              tags: row.tags || [],
              score: row.relevance * this.config.textWeight + 
                     row.importance_score * this.config.popularityWeight,
              relevance: row.relevance,
              searchType: 'fulltext',
              source: 'knowledge',
              userId: row.user_id,
            });
          }
        }

        // Search conversations
        if (sources.includes('conversations')) {
          const conversationQuery = `
            SELECT 
              'conversation_message' as type,
              cm.id, c.title, cm.content, cm.role as category,
              ts_rank(
                to_tsvector('english', cm.content),
                plainto_tsquery('english', $1)
              ) as relevance,
              c.user_id
            FROM conversation_messages cm
            JOIN conversations c ON cm.conversation_id = c.id
            WHERE to_tsvector('english', cm.content) @@ plainto_tsquery('english', $1)
              ${userId ? 'AND c.user_id = $2' : ''}
            ORDER BY relevance DESC
            LIMIT $${userId ? '3' : '2'}
          `;

          const params = [query];
          if (userId) params.push(userId);
          params.push(limit);

          const conversationResult = await this.pool.query(conversationQuery, params);
          
          for (const row of conversationResult.rows) {
            results.push({
              id: row.id,
              type: row.type,
              title: row.title || 'Conversation',
              content: row.content,
              category: row.category,
              score: row.relevance * this.config.textWeight * 0.8, // Lower weight for conversations
              relevance: row.relevance,
              searchType: 'fulltext',
              source: 'conversations',
              userId: row.user_id,
            });
          }
        }

        span.setAttributes({
          'fulltext.results_count': results.length,
          'fulltext.avg_relevance': results.length > 0 
            ? results.reduce((sum, r) => sum + (r.relevance || 0), 0) / results.length 
            : 0,
        });

        return results;
      } catch (error) {
        console.error('[AdvancedSearch] ❌ Full-text search failed:', error);
        span.recordException(error);
        return [];
      }
    });
  }

  /**
   * Perform graph-based search using relationships
   */
  async performGraphSearch(query, options = {}) {
    return traceOperation('advanced.search.graph', async (span) => {
      try {
        const { userId, limit = 20 } = options;
        const results = [];

        // Search knowledge relationships
        const relationshipQuery = `
          SELECT 
            'knowledge_relationship' as type,
            kd1.id, kd1.title, 
            'Related to: ' || kd2.title as content,
            kr.relationship_type as category,
            kr.similarity_score as relevance,
            kd1.user_id
          FROM knowledge_relationships kr
          JOIN knowledge_documents kd1 ON kr.source_document_id = kd1.id
          JOIN knowledge_documents kd2 ON kr.target_document_id = kd2.id
          WHERE (kd1.title ILIKE $1 OR kd2.title ILIKE $1)
            ${userId ? 'AND kr.user_id = $2' : ''}
          ORDER BY kr.similarity_score DESC
          LIMIT $${userId ? '3' : '2'}
        `;

        const params = [`%${query}%`];
        if (userId) params.push(userId);
        params.push(limit);

        const relationshipResult = await this.pool.query(relationshipQuery, params);
        
        for (const row of relationshipResult.rows) {
          results.push({
            id: `rel_${row.id}`,
            type: row.type,
            title: row.title,
            content: row.content,
            category: row.category,
            score: row.relevance * this.config.graphWeight,
            relevance: row.relevance,
            searchType: 'graph',
            source: 'relationships',
            userId: row.user_id,
          });
        }

        span.setAttributes({
          'graph.results_count': results.length,
        });

        return results;
      } catch (error) {
        console.error('[AdvancedSearch] ❌ Graph search failed:', error);
        span.recordException(error);
        return [];
      }
    });
  }

  /**
   * Combine search results from different strategies
   */
  combineSearchResults(searchResultSets, options = {}) {
    const combinedMap = new Map();
    const weights = {
      semantic: this.config.semanticWeight,
      fulltext: this.config.textWeight,
      graph: this.config.graphWeight,
    };

    // Combine results and boost scores for items found by multiple strategies
    for (const resultSet of searchResultSets) {
      for (const result of resultSet) {
        const key = `${result.source}_${result.id}`;
        
        if (combinedMap.has(key)) {
          const existing = combinedMap.get(key);
          existing.score += result.score * 0.5; // Boost for multiple matches
          existing.searchTypes.push(result.searchType);
          existing.multiMatch = true;
        } else {
          combinedMap.set(key, {
            ...result,
            searchTypes: [result.searchType],
            multiMatch: false,
          });
        }
      }
    }

    return Array.from(combinedMap.values());
  }

  /**
   * Apply advanced filters to search results
   */
  applyAdvancedFilters(results, filters = {}) {
    let filtered = results;

    // Category filter
    if (filters.categories && filters.categories.length > 0) {
      filtered = filtered.filter(result => 
        filters.categories.includes(result.category)
      );
    }

    // Date range filter
    if (filters.dateRange) {
      const { from, to } = filters.dateRange;
      filtered = filtered.filter(result => {
        const date = new Date(result.timestamp || result.created_at);
        return (!from || date >= new Date(from)) && 
               (!to || date <= new Date(to));
      });
    }

    // Source filter
    if (filters.sources && filters.sources.length > 0) {
      filtered = filtered.filter(result => 
        filters.sources.includes(result.source)
      );
    }

    // Score threshold filter
    if (filters.minScore) {
      filtered = filtered.filter(result => 
        result.score >= filters.minScore
      );
    }

    // Tags filter
    if (filters.tags && filters.tags.length > 0) {
      filtered = filtered.filter(result => 
        result.tags && result.tags.some(tag => 
          filters.tags.includes(tag)
        )
      );
    }

    return filtered;
  }

  /**
   * Generate search facets for filtering
   */
  generateFacets(results, requestedFacets) {
    const facets = {};

    if (requestedFacets.includes('categories')) {
      facets.categories = this.generateCategoryFacets(results);
    }

    if (requestedFacets.includes('sources')) {
      facets.sources = this.generateSourceFacets(results);
    }

    if (requestedFacets.includes('types')) {
      facets.types = this.generateTypeFacets(results);
    }

    if (requestedFacets.includes('tags')) {
      facets.tags = this.generateTagFacets(results);
    }

    return facets;
  }

  /**
   * Generate category facets
   */
  generateCategoryFacets(results) {
    const categories = new Map();
    
    for (const result of results) {
      const category = result.category || 'uncategorized';
      categories.set(category, (categories.get(category) || 0) + 1);
    }

    return Array.from(categories.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }

  /**
   * Generate source facets
   */
  generateSourceFacets(results) {
    const sources = new Map();
    
    for (const result of results) {
      const source = result.source || 'unknown';
      sources.set(source, (sources.get(source) || 0) + 1);
    }

    return Array.from(sources.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }

  /**
   * Generate type facets
   */
  generateTypeFacets(results) {
    const types = new Map();
    
    for (const result of results) {
      const type = result.type || 'unknown';
      types.set(type, (types.get(type) || 0) + 1);
    }

    return Array.from(types.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }

  /**
   * Generate tag facets
   */
  generateTagFacets(results) {
    const tags = new Map();
    
    for (const result of results) {
      if (result.tags && Array.isArray(result.tags)) {
        for (const tag of result.tags) {
          tags.set(tag, (tags.get(tag) || 0) + 1);
        }
      }
    }

    return Array.from(tags.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20); // Limit tag facets
  }

  /**
   * Rank and limit final search results
   */
  rankAndLimitResults(results, limit) {
    // Apply sophisticated ranking algorithm
    const rankedResults = results
      .map(result => {
        // Calculate final score considering various factors
        let finalScore = result.score;
        
        // Boost multi-match results
        if (result.multiMatch) {
          finalScore *= 1.2;
        }
        
        // Boost recent content
        if (result.timestamp) {
          const age = Date.now() - new Date(result.timestamp).getTime();
          const dayAge = age / (1000 * 60 * 60 * 24);
          const recencyBoost = Math.max(0, 1 - (dayAge / 365)); // Decay over a year
          finalScore += recencyBoost * 0.1;
        }
        
        // Add snippet and highlight
        result.snippet = this.generateSnippet(result.content, result.title);
        result.finalScore = finalScore;
        
        return result;
      })
      .sort((a, b) => b.finalScore - a.finalScore)
      .slice(0, limit);

    return rankedResults;
  }

  /**
   * Generate content snippet with highlighting
   */
  generateSnippet(content, title = '') {
    const maxLength = 200;
    
    if (!content || content.length <= maxLength) {
      return content || title.substring(0, maxLength);
    }
    
    // Try to find a good breaking point
    const snippet = content.substring(0, maxLength);
    const lastSentence = snippet.lastIndexOf('.');
    const lastSpace = snippet.lastIndexOf(' ');
    
    const breakPoint = lastSentence > maxLength * 0.7 ? lastSentence + 1 : lastSpace;
    
    return content.substring(0, breakPoint) + '...';
  }

  /**
   * Calculate search confidence score
   */
  calculateSearchConfidence(results) {
    if (results.length === 0) return 0;
    
    const avgScore = results.reduce((sum, r) => sum + (r.finalScore || r.score), 0) / results.length;
    const multiMatchBonus = results.filter(r => r.multiMatch).length / results.length * 0.1;
    
    return Math.min(1, avgScore + multiMatchBonus);
  }

  /**
   * Generate embedding for text
   */
  async generateEmbedding(text) {
    try {
      const response = await this.openai.embeddings.create({
        model: this.config.embeddingModel,
        input: text.substring(0, 8000), // OpenAI limit
      });

      return response.data[0].embedding;
    } catch (error) {
      console.error('[AdvancedSearch] ❌ Embedding generation failed:', error);
      throw error;
    }
  }

  /**
   * Test search capabilities
   */
  async testSearchCapabilities() {
    try {
      // Test embedding generation
      const testEmbedding = await this.generateEmbedding('test search query');
      
      // Test basic search
      const testSearch = await this.search('test', {
        limit: 5,
        searchTypes: ['semantic', 'fulltext'],
        sources: ['knowledge'],
      });
      
      console.log(`[AdvancedSearch] ✅ Search capabilities test passed (${testEmbedding.length}D embeddings, ${testSearch.results.length} results)`);
    } catch (error) {
      console.error('[AdvancedSearch] ❌ Search capabilities test failed:', error);
      throw error;
    }
  }

  /**
   * Log search for analytics
   */
  logSearch(query, results, userId) {
    try {
      this.analytics.totalSearches++;
      this.analytics.popularQueries.set(query, 
        (this.analytics.popularQueries.get(query) || 0) + 1
      );
      
      // Track search patterns
      const pattern = {
        query: query.toLowerCase(),
        resultCount: results.results.length,
        confidence: results.analytics.confidence,
        timestamp: Date.now(),
      };
      
      this.analytics.searchPatterns.set(
        `${userId}_${Date.now()}`, 
        pattern
      );
      
      // Keep only last 1000 patterns to avoid memory issues
      if (this.analytics.searchPatterns.size > 1000) {
        const oldestKey = this.analytics.searchPatterns.keys().next().value;
        this.analytics.searchPatterns.delete(oldestKey);
      }
      
      // Log to database asynchronously
      this.logSearchToDatabase(query, results, userId).catch(error => {
        console.warn('[AdvancedSearch] ⚠️ Database search logging failed:', error.message);
      });
    } catch (error) {
      console.warn('[AdvancedSearch] ⚠️ Search logging failed:', error.message);
    }
  }

  /**
   * Log search to database
   */
  async logSearchToDatabase(query, results, userId) {
    if (!userId) return;
    
    try {
      await this.pool.query(`
        INSERT INTO search_analytics (
          user_id, query, results_count, search_time_ms, 
          confidence_score, search_types, sources
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        userId,
        query,
        results.analytics.totalMatches,
        results.analytics.searchTime,
        results.analytics.confidence,
        JSON.stringify(results.searchTypes || []),
        JSON.stringify(results.sources || [])
      ]);
    } catch (error) {
      // Fail silently for logging errors
      console.warn('[AdvancedSearch] Database logging failed:', error.message);
    }
  }

  /**
   * Get search analytics
   */
  getAnalytics() {
    return {
      totalSearches: this.analytics.totalSearches,
      popularQueries: Array.from(this.analytics.popularQueries.entries())
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10),
      indexSizes: {
        knowledge: this.searchIndexes.knowledge.size,
        conversations: this.searchIndexes.conversations.size,
        workflows: this.searchIndexes.workflows.size,
        documents: this.searchIndexes.documents.size,
      },
    };
  }

  /**
   * Refresh search indexes
   */
  async refreshIndexes() {
    console.log('[AdvancedSearch] 🔄 Refreshing search indexes...');
    
    // Clear existing indexes
    this.searchIndexes.knowledge.clear();
    this.searchIndexes.conversations.clear();
    this.searchIndexes.workflows.clear();
    this.searchIndexes.documents.clear();
    
    // Rebuild indexes
    await this.buildSearchIndexes();
    
    console.log('[AdvancedSearch] ✅ Search indexes refreshed');
  }
}

export default AdvancedSearchService;
