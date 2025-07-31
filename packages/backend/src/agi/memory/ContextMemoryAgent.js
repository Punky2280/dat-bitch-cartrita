const BaseAgent = require('../../system/BaseAgent');

class ContextMemoryAgent extends BaseAgent {
  constructor() {
    super('ContextMemoryAgent', 'main', [
      'long_term_context_retention',
      'context_compression',
      'memory_prioritization',
      'intelligent_retrieval',
      'context_synthesis',
      'episodic_memory_management'
    ]);
    
    this.contextStore = new Map();
    this.episodicMemory = new Map();
    this.contextHierarchy = new Map();
    this.memoryPriorities = new Map();
    this.compressionRules = new Set();
    this.initializeMemoryFramework();
  }

  async onInitialize() {
    this.registerTaskHandler('store_context', this.storeContext.bind(this));
    this.registerTaskHandler('retrieve_context', this.retrieveContext.bind(this));
    this.registerTaskHandler('compress_memory', this.compressMemory.bind(this));
    this.registerTaskHandler('prioritize_memories', this.prioritizeMemories.bind(this));
    this.registerTaskHandler('synthesize_context', this.synthesizeContext.bind(this));
    this.registerTaskHandler('manage_episodic_memory', this.manageEpisodicMemory.bind(this));
    this.registerTaskHandler('search_memory', this.searchMemory.bind(this));
    this.registerTaskHandler('generate_memory_report', this.generateMemoryReport.bind(this));
    
    console.log('[ContextMemoryAgent] Long-term context retention and memory management handlers registered');
  }

  initializeMemoryFramework() {
    // Memory compression rules
    this.compressionRules.add({
      name: 'semantic_compression',
      condition: 'similar_contexts_threshold > 0.8',
      action: 'merge_similar_contexts',
      retention_factor: 0.9
    });
    
    this.compressionRules.add({
      name: 'temporal_compression',
      condition: 'age > 30_days && access_frequency < 0.1',
      action: 'compress_temporal_details',
      retention_factor: 0.7
    });
    
    this.compressionRules.add({
      name: 'redundancy_elimination',
      condition: 'duplicate_information_detected',
      action: 'eliminate_redundant_data',
      retention_factor: 0.8
    });
  }

  async storeContext(prompt, language, userId, payload) {
    try {
      const { context_data, context_type = 'conversation', importance_score = 5, metadata = {} } = payload;
      
      if (!context_data) {
        throw new Error('No context data provided for storage');
      }
      
      // Generate context ID
      const contextId = this.generateContextId(userId, context_type);
      
      // Analyze context importance and relevance
      const contextAnalysis = await this.analyzeContextImportance(context_data, context_type);
      
      // Create context entry
      const contextEntry = {
        id: contextId,
        user_id: userId,
        context_type: context_type,
        data: context_data,
        importance_score: Math.max(importance_score, contextAnalysis.importance),
        relevance_score: contextAnalysis.relevance,
        created_at: new Date().toISOString(),
        last_accessed: new Date().toISOString(),
        access_count: 1,
        metadata: {
          ...metadata,
          language: language,
          data_size: JSON.stringify(context_data).length,
          keywords: contextAnalysis.keywords,
          entities: contextAnalysis.entities
        }
      };
      
      // Store in appropriate memory store
      this.contextStore.set(contextId, contextEntry);
      
      // Update memory hierarchies
      await this.updateMemoryHierarchies(contextEntry);
      
      // Update priority mappings
      this.updateMemoryPriorities(contextEntry);
      
      // Check if compression is needed
      await this.checkCompressionNeeded(userId);
      
      return {
        context_stored: true,
        context_id: contextId,
        importance_score: contextEntry.importance_score,
        relevance_score: contextEntry.relevance_score,
        storage_location: 'long_term_memory',
        memory_size: this.contextStore.size,
        estimated_retrieval_time: this.estimateRetrievalTime(contextEntry)
      };
      
    } catch (error) {
      console.error('[ContextMemoryAgent] Error storing context:', error);
      throw error;
    }
  }

  async retrieveContext(prompt, language, userId, payload) {
    try {
      const { query, retrieval_type = 'semantic', max_results = 10, time_range = 'all', context_types = ['all'] } = payload;
      
      let retrievalResults = [];
      
      // Execute different retrieval strategies
      switch (retrieval_type) {
        case 'semantic':
          retrievalResults = await this.semanticRetrieval(query, userId, max_results, time_range, context_types);
          break;
          
        case 'temporal':
          retrievalResults = await this.temporalRetrieval(query, userId, max_results, time_range, context_types);
          break;
          
        case 'episodic':
          retrievalResults = await this.episodicRetrieval(query, userId, max_results, time_range, context_types);
          break;
          
        case 'associative':
          retrievalResults = await this.associativeRetrieval(query, userId, max_results, time_range, context_types);
          break;
          
        case 'priority_based':
          retrievalResults = await this.priorityBasedRetrieval(query, userId, max_results, time_range, context_types);
          break;
          
        default:
          retrievalResults = await this.semanticRetrieval(query, userId, max_results, time_range, context_types);
      }
      
      // Update access patterns
      await this.updateAccessPatterns(retrievalResults);
      
      // Generate retrieval explanations
      const explanations = await this.generateRetrievalExplanations(retrievalResults, query, retrieval_type);
      
      return {
        query: query,
        retrieval_type: retrieval_type,
        results: retrievalResults,
        result_count: retrievalResults.length,
        retrieval_confidence: this.calculateRetrievalConfidence(retrievalResults),
        explanations: explanations,
        retrieval_timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('[ContextMemoryAgent] Error retrieving context:', error);
      throw error;
    }
  }

  // Helper methods
  generateContextId(userId, contextType) {
    return `ctx_${userId}_${contextType}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async analyzeContextImportance(contextData, contextType) {
    // Simplified importance analysis
    let importance = 5; // Default importance
    
    // Adjust based on context type
    const typeImportance = {
      'conversation': 6,
      'task': 8,
      'error': 7,
      'achievement': 9,
      'preference': 8
    };
    
    importance = typeImportance[contextType] || 5;
    
    // Adjust based on content characteristics
    const contentStr = JSON.stringify(contextData);
    if (contentStr.length > 1000) importance += 1;
    if (contentStr.includes('important') || contentStr.includes('critical')) importance += 2;
    
    return {
      importance: Math.min(10, importance),
      relevance: Math.random() * 0.3 + 0.7, // Random relevance for demo
      keywords: this.extractKeywords(contentStr),
      entities: this.extractEntities(contentStr)
    };
  }

  extractKeywords(text) {
    // Simple keyword extraction
    return text.toLowerCase()
      .split(/\W+/)
      .filter(word => word.length > 3)
      .slice(0, 10);
  }

  extractEntities(text) {
    // Simple entity extraction
    const entities = [];
    const words = text.split(/\s+/);
    
    words.forEach(word => {
      if (/^[A-Z][a-z]+/.test(word)) {
        entities.push(word);
      }
    });
    
    return entities.slice(0, 5);
  }

  async updateMemoryHierarchies(contextEntry) {
    const hierarchy = this.contextHierarchy.get(contextEntry.user_id) || {
      by_type: new Map(),
      by_importance: new Map(),
      by_time: new Map()
    };
    
    // Update type hierarchy
    if (!hierarchy.by_type.has(contextEntry.context_type)) {
      hierarchy.by_type.set(contextEntry.context_type, []);
    }
    hierarchy.by_type.get(contextEntry.context_type).push(contextEntry.id);
    
    this.contextHierarchy.set(contextEntry.user_id, hierarchy);
  }

  updateMemoryPriorities(contextEntry) {
    const priority = this.computeBasicPriority(contextEntry);
    this.memoryPriorities.set(contextEntry.id, priority);
  }

  computeBasicPriority(contextEntry) {
    let priority = contextEntry.importance_score || 5;
    
    // Recent contexts get higher priority
    const age = Date.now() - new Date(contextEntry.created_at).getTime();
    const ageInDays = age / (1000 * 60 * 60 * 24);
    
    if (ageInDays < 1) priority += 2;
    else if (ageInDays < 7) priority += 1;
    else if (ageInDays > 30) priority -= 1;
    
    // Frequently accessed contexts get higher priority
    if (contextEntry.access_count > 5) priority += 1;
    
    return Math.max(1, Math.min(10, priority));
  }

  estimateRetrievalTime(contextEntry) {
    const baseTime = 50; // Base retrieval time in ms
    const sizeMultiplier = JSON.stringify(contextEntry.data).length / 1000;
    return Math.round(baseTime + (sizeMultiplier * 10));
  }

  calculateRetrievalConfidence(results) {
    if (results.length === 0) return 0;
    const scores = results.map(r => r.relevance_score || 0);
    const average = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    const variance = scores.reduce((sum, score) => sum + Math.pow(score - average, 2), 0) / scores.length;
    return Math.max(0, average - Math.sqrt(variance));
  }

  // Placeholder methods for complex operations
  async checkCompressionNeeded(userId) { return false; }
  async updateAccessPatterns(results) { return true; }
  async semanticRetrieval(query, userId, maxResults, timeRange, contextTypes) { return []; }
  async temporalRetrieval(query, userId, maxResults, timeRange, contextTypes) { return []; }
  async episodicRetrieval(query, userId, maxResults, timeRange, contextTypes) { return []; }
  async associativeRetrieval(query, userId, maxResults, timeRange, contextTypes) { return []; }
  async priorityBasedRetrieval(query, userId, maxResults, timeRange, contextTypes) { return []; }
  async generateRetrievalExplanations(results, query, type) { return []; }
}

module.exports = ContextMemoryAgent;