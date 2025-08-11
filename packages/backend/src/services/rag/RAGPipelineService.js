import axios from 'axios';
import keyVaultService from '../security/keyVaultService.js';
import OpenTelemetryTracing from '../../system/OpenTelemetryTracing.js';

export default class RAGPipelineService {
  constructor() {
    this.hfBaseURL = 'https://api-inference.huggingface.co';
    this.cache = new Map();
    this.cacheTTL = 1000 * 60 * 30; // 30 minutes
  }

  async initializeToken() {
    if (this.token) return this.token;
    
    const keyRecord = await keyVaultService.get('huggingface_api_token');
    if (!keyRecord || !keyRecord.decryptedKey) {
      throw new Error('HuggingFace token unavailable');
    }
    
    this.token = keyRecord.decryptedKey;
    return this.token;
  }

  /**
   * Generate embeddings for text using HF embedding models
   */
  async generateEmbeddings(texts, model = 'BAAI/bge-large-en-v1.5') {
    return OpenTelemetryTracing.traceOperation('rag.embeddings', {}, async () => {
      const token = await this.initializeToken();
      
      // Handle single text or array
      const textArray = Array.isArray(texts) ? texts : [texts];
      const embeddings = [];
      
      for (const text of textArray) {
        // Check cache first
        const cacheKey = `embed:${model}:${Buffer.from(text).toString('base64').slice(0, 32)}`;
        const cached = this.cache.get(cacheKey);
        
        if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
          embeddings.push(cached.data);
          continue;
        }

        try {
          const response = await axios.post(
            `${this.hfBaseURL}/models/${model}`,
            { inputs: text },
            {
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              },
              timeout: 30000
            }
          );

          let embedding;
          if (Array.isArray(response.data)) {
            embedding = response.data;
          } else if (response.data.embeddings) {
            embedding = response.data.embeddings;
          } else {
            embedding = response.data;
          }

          embeddings.push(embedding);
          
          // Cache result
          this.cache.set(cacheKey, {
            data: embedding,
            timestamp: Date.now()
          });
          
        } catch (error) {
          console.error(`Embedding generation failed for model ${model}:`, error.message);
          // Return zero vector as fallback
          embeddings.push(new Array(768).fill(0)); // Default dimension
        }
      }
      
      return Array.isArray(texts) ? embeddings : embeddings[0];
    });
  }

  /**
   * Rerank documents using cross-encoder models
   */
  async rerankDocuments(query, documents, model = 'BAAI/bge-reranker-large', topK = 10) {
    return OpenTelemetryTracing.traceOperation('rag.rerank', {}, async () => {
      const token = await this.initializeToken();
      
      if (!documents.length) return [];
      
      try {
        // Prepare query-document pairs for reranking
        const pairs = documents.map(doc => ({
          query: query,
          text: typeof doc === 'string' ? doc : doc.text || doc.content || String(doc)
        }));

        const response = await axios.post(
          `${this.hfBaseURL}/models/${model}`,
          { inputs: pairs },
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            timeout: 45000
          }
        );

        // Process reranking scores
        const scores = Array.isArray(response.data) ? response.data : [response.data];
        
        // Combine documents with scores
        const rankedResults = documents.map((doc, index) => ({
          document: doc,
          score: scores[index]?.score || scores[index] || 0,
          relevance: scores[index]?.label === 'RELEVANT' ? 1 : 0
        }));

        // Sort by score descending and return top K
        return rankedResults
          .sort((a, b) => b.score - a.score)
          .slice(0, topK);
          
      } catch (error) {
        console.error(`Reranking failed for model ${model}:`, error.message);
        
        // Fallback: return documents with default scores
        return documents.slice(0, topK).map((doc, index) => ({
          document: doc,
          score: 1.0 - (index * 0.1), // Simple decreasing score
          relevance: 1
        }));
      }
    });
  }

  /**
   * Complete RAG pipeline: retrieve, rerank, generate
   */
  async executeRAGPipeline(query, documentStore, options = {}) {
    return OpenTelemetryTracing.traceOperation('rag.full_pipeline', {}, async () => {
      const {
        embeddingModel = 'BAAI/bge-large-en-v1.5',
        rerankModel = 'BAAI/bge-reranker-large',
        generationModel = 'meta-llama/Meta-Llama-3-8B-Instruct',
        topKRetrieval = 20,
        topKRerank = 8,
        useMultiQuery = false,
        includeCitations = true
      } = options;

      const startTime = Date.now();
      
      try {
        // Step 1: Query expansion (optional)
        let queries = [query];
        if (useMultiQuery) {
          queries = await this.expandQuery(query, generationModel);
        }

        // Step 2: Dense retrieval
        const allCandidates = [];
        for (const q of queries) {
          const queryEmbedding = await this.generateEmbeddings(q, embeddingModel);
          const candidates = await this.retrieveDocuments(queryEmbedding, documentStore, topKRetrieval);
          allCandidates.push(...candidates);
        }

        // Remove duplicates and merge
        const uniqueCandidates = this.deduplicateDocuments(allCandidates);

        // Step 3: Reranking
        const rerankedDocs = await this.rerankDocuments(query, uniqueCandidates, rerankModel, topKRerank);

        // Step 4: Context preparation
        const context = this.prepareContext(rerankedDocs, includeCitations);

        // Step 5: Generate answer
        const answer = await this.generateAnswer(query, context, generationModel);

        // Step 6: Self-evaluation (optional)
        const confidence = await this.evaluateAnswerConfidence(answer, context);

        return {
          answer,
          confidence,
          context_used: rerankedDocs,
          sources: rerankedDocs.map((item, idx) => ({
            id: idx + 1,
            content: typeof item.document === 'string' ? item.document : item.document.text,
            score: item.score,
            relevance: item.relevance
          })),
          metadata: {
            query_expanded: queries.length > 1,
            total_candidates: uniqueCandidates.length,
            reranked_count: rerankedDocs.length,
            models_used: { embeddingModel, rerankModel, generationModel },
            pipeline_duration_ms: Date.now() - startTime
          }
        };

      } catch (error) {
        console.error('[RAG Pipeline] Error:', error.message);
        throw new Error(`RAG pipeline failed: ${error.message}`);
      }
    });
  }

  /**
   * Expand query into multiple variations for better retrieval
   */
  async expandQuery(originalQuery, model = 'microsoft/Phi-3-mini-4k-instruct') {
    try {
      const token = await this.initializeToken();
      
      const prompt = `Generate 2-3 alternative ways to ask this question for better search results:

Original question: "${originalQuery}"

Alternative questions:
1.`;

      const response = await axios.post(
        `${this.hfBaseURL}/models/${model}`,
        {
          inputs: prompt,
          parameters: {
            max_new_tokens: 150,
            temperature: 0.7,
            stop: ['\n\n', '4.']
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      );

      let generatedText = '';
      if (typeof response.data === 'string') {
        generatedText = response.data;
      } else if (Array.isArray(response.data) && response.data[0]?.generated_text) {
        generatedText = response.data[0].generated_text;
      } else if (response.data.generated_text) {
        generatedText = response.data.generated_text;
      }

      // Extract alternative questions
      const alternatives = generatedText
        .split(/\d+\./)
        .slice(1)
        .map(q => q.trim())
        .filter(q => q.length > 10)
        .slice(0, 3);

      return [originalQuery, ...alternatives];

    } catch (error) {
      console.warn('Query expansion failed:', error.message);
      return [originalQuery];
    }
  }

  /**
   * Retrieve documents based on embedding similarity
   * This is a placeholder - integrate with your vector store
   */
  async retrieveDocuments(queryEmbedding, documentStore, topK = 20) {
    // Placeholder implementation - replace with your vector store logic
    // This would typically use Pinecone, Weaviate, Chroma, etc.
    
    if (Array.isArray(documentStore)) {
      // Simple array-based retrieval for demonstration
      return documentStore.slice(0, topK).map(doc => ({
        text: typeof doc === 'string' ? doc : doc.text || doc.content,
        metadata: doc.metadata || {},
        score: Math.random() * 0.5 + 0.5 // Placeholder similarity score
      }));
    }
    
    // If documentStore has a search method
    if (documentStore && typeof documentStore.search === 'function') {
      return await documentStore.search(queryEmbedding, topK);
    }
    
    throw new Error('Document store not properly configured for retrieval');
  }

  /**
   * Remove duplicate documents based on content similarity
   */
  deduplicateDocuments(documents, threshold = 0.8) {
    const unique = [];
    
    for (const doc of documents) {
      const content = typeof doc === 'string' ? doc : doc.text || doc.content;
      const isDuplicate = unique.some(existingDoc => {
        const existingContent = typeof existingDoc === 'string' ? existingDoc : existingDoc.text || existingDoc.content;
        return this.calculateStringSimilarity(content, existingContent) > threshold;
      });
      
      if (!isDuplicate) {
        unique.push(doc);
      }
    }
    
    return unique;
  }

  /**
   * Simple string similarity calculation
   */
  calculateStringSimilarity(str1, str2) {
    const set1 = new Set(str1.toLowerCase().split(/\s+/));
    const set2 = new Set(str2.toLowerCase().split(/\s+/));
    
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    
    return intersection.size / union.size;
  }

  /**
   * Prepare context from reranked documents
   */
  prepareContext(rerankedDocs, includeCitations = true) {
    return rerankedDocs.map((item, index) => {
      const content = typeof item.document === 'string' ? item.document : item.document.text || item.document.content;
      const citation = includeCitations ? `[Source ${index + 1}]` : '';
      return `${citation} ${content}`.trim();
    }).join('\n\n');
  }

  /**
   * Generate answer using the prepared context
   */
  async generateAnswer(query, context, model = 'meta-llama/Meta-Llama-3-8B-Instruct') {
    const token = await this.initializeToken();
    
    const prompt = `You are answering based strictly on the provided context. If the context doesn't contain enough information to answer the question, say "INSUFFICIENT EVIDENCE."

Context:
${context}

Question: ${query}

Answer (with citations if applicable):`;

    const response = await axios.post(
      `${this.hfBaseURL}/models/${model}`,
      {
        inputs: prompt,
        parameters: {
          max_new_tokens: 400,
          temperature: 0.3,
          top_p: 0.9
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        timeout: 45000
      }
    );

    let answer = '';
    if (typeof response.data === 'string') {
      answer = response.data;
    } else if (Array.isArray(response.data) && response.data[0]?.generated_text) {
      answer = response.data[0].generated_text;
    } else if (response.data.generated_text) {
      answer = response.data.generated_text;
    }

    // Clean up the answer (remove the prompt if it's included)
    const answerStart = answer.lastIndexOf('Answer (with citations if applicable):');
    if (answerStart !== -1) {
      answer = answer.substring(answerStart + 38).trim();
    }

    return answer;
  }

  /**
   * Evaluate answer confidence using multiple heuristics
   */
  async evaluateAnswerConfidence(answer, context) {
    if (!answer || answer.includes('INSUFFICIENT EVIDENCE')) {
      return 0.1;
    }

    // Length-based confidence
    const lengthScore = Math.min(answer.length / 200, 1.0);
    
    // Citation presence
    const citationScore = (answer.match(/\[Source \d+\]/g) || []).length > 0 ? 0.2 : 0;
    
    // Context overlap (simple word overlap)
    const answerWords = new Set(answer.toLowerCase().split(/\s+/));
    const contextWords = new Set(context.toLowerCase().split(/\s+/));
    const overlap = [...answerWords].filter(word => contextWords.has(word)).length;
    const overlapScore = Math.min(overlap / answerWords.size, 1.0);
    
    // Combine scores
    return 0.4 * lengthScore + 0.2 * citationScore + 0.4 * overlapScore;
  }

  /**
   * Clear embedding cache
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      size: this.cache.size,
      entries: Array.from(this.cache.keys())
    };
  }
}