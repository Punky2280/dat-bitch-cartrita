/**
 * Cartrita V2 - Embeddings Usage Examples
 * Comprehensive demonstrations of text embeddings capabilities
 */

import { embeddingsService } from './src/services/EmbeddingsService.js';
import { openAIService } from './src/services/OpenAIService.js';

class EmbeddingsExamples {
  async initialize() {
    console.log('🚀 Initializing Embeddings Examples...\n');
    await openAIService.initialize();
    await embeddingsService.initialize();
    console.log('✅ Services initialized\n');
  }

  async example1_BasicEmbedding() {
    console.log('📝 Example 1: Basic Text Embedding');
    console.log('=' * 40);
    
    const text = "Artificial intelligence is transforming how we interact with technology.";
    
    const result = await embeddingsService.createEmbedding(text, {
      model: 'text-embedding-3-small'
    });
    
    const embedding = result.data[0];
    
    console.log(`Text: "${text}"`);
    console.log(`Model: ${embedding.model}`);
    console.log(`Dimensions: ${embedding.dimensions}`);
    console.log(`Token Count: ${embedding.tokenCount}`);
    console.log(`From Cache: ${embedding.fromCache}`);
    console.log(`Embedding Preview: [${embedding.embedding.slice(0, 5).map(n => n.toFixed(4)).join(', ')}...]`);
    console.log(`Usage: ${result.usage.total_tokens} tokens`);
    console.log(`Estimated Cost: $${result.metadata.estimatedCost.toFixed(8)}\n`);
    
    return embedding;
  }

  async example2_MultipleTexts() {
    console.log('📚 Example 2: Multiple Text Embeddings');
    console.log('=' * 40);
    
    const texts = [
      "The weather is sunny today.",
      "I love reading books about science fiction.",
      "Machine learning algorithms can process vast amounts of data.",
      "Cooking is both an art and a science.",
      "Music has the power to evoke emotions."
    ];
    
    const result = await embeddingsService.createEmbedding(texts, {
      model: 'text-embedding-3-small'
    });
    
    console.log(`Processed ${texts.length} texts:`);
    result.data.forEach((embedding, index) => {
      console.log(`  ${index + 1}. "${texts[index].substring(0, 40)}..."`);
      console.log(`     Dimensions: ${embedding.dimensions}, Tokens: ${embedding.tokenCount}, Cached: ${embedding.fromCache}`);
    });
    
    console.log(`\nBatch Statistics:`);
    console.log(`  Total tokens: ${result.usage.total_tokens}`);
    console.log(`  Cache hits: ${result.metadata.cacheHits}`);
    console.log(`  Cache misses: ${result.metadata.cacheMisses}`);
    console.log(`  Cache efficiency: ${result.metadata.cacheEfficiency.toFixed(1)}%`);
    console.log(`  Duration: ${result.metadata.duration}ms\n`);
    
    return result.data;
  }

  async example3_ModelComparison() {
    console.log('🔄 Example 3: Model Comparison');
    console.log('=' * 40);
    
    const text = "Quantum computing represents a paradigm shift in computational power.";
    const models = ['text-embedding-3-small', 'text-embedding-3-large'];
    
    console.log(`Text: "${text}"\n`);
    
    const results = {};
    for (const model of models) {
      const result = await embeddingsService.createEmbedding(text, {
        model,
        useCache: false
      });
      
      const embedding = result.data[0];
      results[model] = embedding;
      
      console.log(`${model}:`);
      console.log(`  Dimensions: ${embedding.dimensions}`);
      console.log(`  Token Count: ${embedding.tokenCount}`);
      console.log(`  Duration: ${result.metadata.duration}ms`);
      console.log(`  Cost: $${result.metadata.estimatedCost.toFixed(8)}`);
      console.log(`  First 3 values: [${embedding.embedding.slice(0, 3).map(n => n.toFixed(6)).join(', ')}]`);
      console.log();
    }
    
    return results;
  }

  async example4_CustomDimensions() {
    console.log('📏 Example 4: Custom Dimensions');
    console.log('=' * 40);
    
    const text = "Custom dimensionality allows for memory and storage optimization.";
    const dimensions = [256, 512, 1024, 1536];
    
    console.log(`Text: "${text}"\n`);
    
    for (const dim of dimensions) {
      const result = await embeddingsService.createEmbedding(text, {
        model: 'text-embedding-3-small',
        dimensions: dim,
        useCache: false
      });
      
      const embedding = result.data[0];
      
      console.log(`${dim} dimensions:`);
      console.log(`  Actual dimensions: ${embedding.embedding.length}`);
      console.log(`  Storage reduction: ${((1536 - dim) / 1536 * 100).toFixed(1)}% smaller`);
      console.log(`  Duration: ${result.metadata.duration}ms`);
      console.log();
    }
  }

  async example5_SemanticSimilarity() {
    console.log('🔍 Example 5: Semantic Similarity Search');
    console.log('=' * 40);
    
    // Create a knowledge base
    const documents = [
      "Python is a high-level programming language known for its simplicity.",
      "JavaScript is primarily used for web development and client-side scripting.",
      "Machine learning enables computers to learn without explicit programming.",
      "Deep learning is a subset of machine learning using neural networks.",
      "Natural language processing helps computers understand human language.",
      "Computer vision allows machines to interpret and understand visual information.",
      "Artificial intelligence aims to create machines that can think like humans.",
      "Data science combines statistics, programming, and domain expertise."
    ];
    
    // Generate embeddings for all documents
    const docResult = await embeddingsService.createEmbedding(documents, {
      model: 'text-embedding-3-small'
    });
    
    // Create candidates for similarity search
    const candidates = documents.map((doc, index) => ({
      text: doc,
      embedding: docResult.data[index].embedding,
      metadata: { docId: index, category: 'knowledge_base' }
    }));
    
    // Query for AI-related content
    const query = "What is artificial intelligence and machine learning?";
    const queryResult = await embeddingsService.createEmbedding(query, {
      model: 'text-embedding-3-small'
    });
    
    const queryEmbedding = queryResult.data[0].embedding;
    
    // Find most similar documents
    const similarDocs = embeddingsService.findMostSimilar(queryEmbedding, candidates, 5);
    
    console.log(`Query: "${query}"\n`);
    console.log('Most similar documents:');
    similarDocs.forEach((doc, index) => {
      console.log(`  ${index + 1}. Similarity: ${doc.similarity.toFixed(4)}`);
      console.log(`     Text: "${doc.text.substring(0, 60)}..."`);
      console.log();
    });
    
    return similarDocs;
  }

  async example6_BulkProcessing() {
    console.log('⚡ Example 6: Bulk Processing with Batching');
    console.log('=' * 40);
    
    // Generate sample data
    const categories = ['Technology', 'Science', 'Art', 'Sports', 'Food'];
    const inputs = [];
    
    for (let i = 0; i < 50; i++) {
      const category = categories[i % categories.length];
      inputs.push({
        id: `doc_${i.toString().padStart(3, '0')}`,
        text: `This is a sample document about ${category.toLowerCase()} topic number ${i + 1}. It contains various information related to ${category.toLowerCase()} and serves as test data for bulk processing capabilities.`,
        metadata: { 
          category,
          index: i,
          created: new Date().toISOString()
        }
      });
    }
    
    const startTime = Date.now();
    const results = [];
    const batchSize = 15;
    const totalBatches = Math.ceil(inputs.length / batchSize);
    
    console.log(`Processing ${inputs.length} documents in ${totalBatches} batches of ${batchSize}:\n`);
    
    for (let batch = 0; batch < totalBatches; batch++) {
      const start = batch * batchSize;
      const end = Math.min(start + batchSize, inputs.length);
      const batchInputs = inputs.slice(start, end);
      
      const batchTexts = batchInputs.map(input => input.text);
      
      const batchStartTime = Date.now();
      const batchResult = await embeddingsService.createEmbedding(batchTexts, {
        model: 'text-embedding-3-small',
        operationType: 'bulk-processing'
      });
      const batchDuration = Date.now() - batchStartTime;
      
      // Combine results with metadata
      batchInputs.forEach((input, index) => {
        const embeddingData = batchResult.data[index];
        results.push({
          id: input.id,
          text: input.text,
          embedding: embeddingData.embedding,
          dimensions: embeddingData.dimensions,
          tokenCount: embeddingData.tokenCount,
          fromCache: embeddingData.fromCache,
          metadata: input.metadata
        });
      });
      
      console.log(`  Batch ${batch + 1}/${totalBatches}: ${batchInputs.length} items, ${batchDuration}ms, ${batchResult.metadata.cacheEfficiency.toFixed(1)}% cache hit`);
      
      // Small delay between batches
      if (batch < totalBatches - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    const totalDuration = Date.now() - startTime;
    
    // Calculate statistics
    const totalTokens = results.reduce((sum, r) => sum + r.tokenCount, 0);
    const cacheHits = results.filter(r => r.fromCache).length;
    const estimatedCost = embeddingsService.calculateCost(totalTokens, 'text-embedding-3-small');
    
    console.log(`\nBulk Processing Results:`);
    console.log(`  Documents processed: ${results.length}`);
    console.log(`  Total duration: ${totalDuration}ms`);
    console.log(`  Average per document: ${(totalDuration / results.length).toFixed(2)}ms`);
    console.log(`  Total tokens: ${totalTokens}`);
    console.log(`  Cache hits: ${cacheHits}/${results.length} (${(cacheHits / results.length * 100).toFixed(1)}%)`);
    console.log(`  Estimated cost: $${estimatedCost.toFixed(6)}`);
    
    // Group by category
    const byCategory = {};
    results.forEach(result => {
      const category = result.metadata.category;
      if (!byCategory[category]) byCategory[category] = [];
      byCategory[category].push(result);
    });
    
    console.log(`\nResults by category:`);
    Object.entries(byCategory).forEach(([category, docs]) => {
      console.log(`  ${category}: ${docs.length} documents`);
    });
    
    console.log();
    return results;
  }

  async example7_AdvancedSimilaritySearch() {
    console.log('🎯 Example 7: Advanced Similarity Search with Filtering');
    console.log('=' * 40);
    
    // Create a diverse knowledge base
    const knowledgeBase = [
      { text: "Python programming language features and syntax", category: "programming", difficulty: "beginner" },
      { text: "Advanced machine learning algorithms and neural networks", category: "ai", difficulty: "advanced" },
      { text: "Web development with JavaScript and React", category: "programming", difficulty: "intermediate" },
      { text: "Natural language processing techniques", category: "ai", difficulty: "advanced" },
      { text: "Database design and SQL optimization", category: "database", difficulty: "intermediate" },
      { text: "Introduction to computer science concepts", category: "programming", difficulty: "beginner" },
      { text: "Deep learning for computer vision", category: "ai", difficulty: "expert" },
      { text: "RESTful API design and implementation", category: "programming", difficulty: "intermediate" },
      { text: "Data visualization with D3.js", category: "visualization", difficulty: "intermediate" },
      { text: "Kubernetes container orchestration", category: "devops", difficulty: "advanced" }
    ];
    
    // Generate embeddings
    const texts = knowledgeBase.map(item => item.text);
    const embeddingResult = await embeddingsService.createEmbedding(texts, {
      model: 'text-embedding-3-small'
    });
    
    // Create searchable candidates
    const candidates = knowledgeBase.map((item, index) => ({
      text: item.text,
      embedding: embeddingResult.data[index].embedding,
      metadata: {
        category: item.category,
        difficulty: item.difficulty,
        id: `kb_${index}`
      }
    }));
    
    // Multiple search queries
    const queries = [
      "How to learn programming for beginners?",
      "Advanced artificial intelligence techniques",
      "Web development best practices"
    ];
    
    for (const query of queries) {
      console.log(`\nQuery: "${query}"`);
      console.log('-'.repeat(50));
      
      // Get query embedding
      const queryResult = await embeddingsService.createEmbedding(query, {
        model: 'text-embedding-3-small'
      });
      const queryEmbedding = queryResult.data[0].embedding;
      
      // Find similar documents
      const similarities = embeddingsService.findMostSimilar(queryEmbedding, candidates, candidates.length);
      
      // Apply different filtering strategies
      console.log('Top 3 overall:');
      similarities.slice(0, 3).forEach((doc, index) => {
        console.log(`  ${index + 1}. [${doc.similarity.toFixed(4)}] ${doc.text} (${doc.metadata.category}/${doc.metadata.difficulty})`);
      });
      
      // Filter by category
      const programmingDocs = similarities.filter(doc => doc.metadata.category === 'programming').slice(0, 2);
      if (programmingDocs.length > 0) {
        console.log('  Programming-specific:');
        programmingDocs.forEach((doc, index) => {
          console.log(`    ${index + 1}. [${doc.similarity.toFixed(4)}] ${doc.text}`);
        });
      }
      
      // Filter by difficulty
      const beginnerDocs = similarities.filter(doc => doc.metadata.difficulty === 'beginner').slice(0, 2);
      if (beginnerDocs.length > 0) {
        console.log('  Beginner-friendly:');
        beginnerDocs.forEach((doc, index) => {
          console.log(`    ${index + 1}. [${doc.similarity.toFixed(4)}] ${doc.text}`);
        });
      }
    }
    
    console.log();
    return { candidates, queries };
  }

  async example8_CacheManagement() {
    console.log('🗄️ Example 8: Cache Management and Statistics');
    console.log('=' * 40);
    
    // Generate some test data to populate cache
    const testTexts = [
      "Cache management is important for performance optimization.",
      "Text embeddings can be computationally expensive to generate.",
      "Intelligent caching reduces API costs and improves response times.",
      "Database-backed caching provides persistence across sessions."
    ];
    
    // Generate embeddings (will populate cache)
    await embeddingsService.createEmbedding(testTexts, {
      model: 'text-embedding-3-small',
      useCache: true
    });
    
    // Get cache statistics
    const cacheStats = await embeddingsService.getCacheStats();
    
    console.log('Cache Statistics:');
    console.log(`  Total cached entries: ${cacheStats.total.entries}`);
    console.log(`  Estimated storage: ${Math.round(cacheStats.total.storageBytesEstimate / 1024)}KB`);
    
    if (cacheStats.byModel.length > 0) {
      console.log('\nBy model:');
      cacheStats.byModel.forEach(modelStats => {
        console.log(`  ${modelStats.model}:`);
        console.log(`    Cached entries: ${modelStats.cachedCount}`);
        console.log(`    Total accesses: ${modelStats.totalAccesses}`);
        console.log(`    Average accesses: ${modelStats.avgAccesses.toFixed(2)}`);
        console.log(`    Oldest entry: ${modelStats.oldestEntry || 'N/A'}`);
        console.log(`    Most recent: ${modelStats.newestAccess || 'N/A'}`);
      });
    }
    
    // Test cache hit by repeating the same request
    console.log('\nTesting cache hit:');
    const cacheTestText = testTexts[0];
    
    const result1 = await embeddingsService.createEmbedding(cacheTestText, {
      model: 'text-embedding-3-small',
      useCache: true
    });
    
    const result2 = await embeddingsService.createEmbedding(cacheTestText, {
      model: 'text-embedding-3-small',
      useCache: true
    });
    
    console.log(`  First request cache hit: ${result1.data[0].fromCache}`);
    console.log(`  Second request cache hit: ${result2.data[0].fromCache}`);
    console.log(`  Duration comparison: ${result1.metadata.duration}ms vs ${result2.metadata.duration}ms`);
    
    // Note: In production, you might want to clean old cache entries
    console.log('\nCache cleanup would remove entries older than specified days with low access counts.');
    
    console.log();
  }

  async runAllExamples() {
    await this.initialize();
    
    console.log('🎬 Running Comprehensive Embeddings Examples');
    console.log('='.repeat(60));
    console.log();
    
    await this.example1_BasicEmbedding();
    await this.example2_MultipleTexts();
    await this.example3_ModelComparison();
    await this.example4_CustomDimensions();
    await this.example5_SemanticSimilarity();
    await this.example6_BulkProcessing();
    await this.example7_AdvancedSimilaritySearch();
    await this.example8_CacheManagement();
    
    console.log('✅ All examples completed successfully!');
    console.log('\nNext steps:');
    console.log('1. Integrate embeddings into your search functionality');
    console.log('2. Build semantic similarity features');
    console.log('3. Implement content recommendation systems');
    console.log('4. Create document clustering capabilities');
    console.log('5. Enable natural language search across your data');
  }
}

// Auto-run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const examples = new EmbeddingsExamples();
  examples.runAllExamples().catch(error => {
    console.error('💥 Examples failed:', error);
    process.exit(1);
  });
}

export { EmbeddingsExamples };