/**
 * Cartrita V2 - Embeddings Service Test Suite
 * Comprehensive testing for text embeddings with OpenAI models
 */

import { config } from './src/core/config.js';
import { logger } from './src/core/logger.js';
import pg from 'pg';

// Import our services
import EmbeddingsService from './src/services/EmbeddingsService.js';
import { OpenAIServiceManager } from './src/services/OpenAIService.js';

// Initialize services at module level with clean instances
const openAIService = new OpenAIServiceManager();

class EmbeddingsTestSuite {
  constructor() {
    this.results = {
      total: 0,
      passed: 0,
      failed: 0,
      errors: []
    };
    this.embeddingsService = null;
    this.dbPool = null;
  }

  async runTest(testName, testFunction) {
    this.results.total++;
    console.log(`\n🧪 Testing: ${testName}`);
    
    try {
      const startTime = Date.now();
      await testFunction();
      const duration = Date.now() - startTime;
      
      console.log(`✅ PASSED: ${testName} (${duration}ms)`);
      this.results.passed++;
    } catch (error) {
      console.log(`❌ FAILED: ${testName}`);
      console.log(`   Error: ${error.message}`);
      this.results.failed++;
      this.results.errors.push({
        test: testName,
        error: error.message,
        stack: error.stack
      });
    }
  }

  async initialize() {
    console.log('🚀 Initializing Embeddings Test Suite...\n');
    
    try {
      // Create fresh database pool for testing
      const { Pool } = pg;
      const databaseUrl = process.env.DATABASE_URL || config.database.url || 'postgresql://robert:punky1@localhost:5432/dat-bitch-cartrita';
      
      this.dbPool = new Pool({
        connectionString: databaseUrl,
        max: 10,
        min: 2,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
      });

      // Test database connection
      const client = await this.dbPool.connect();
      await client.query('SELECT NOW()');
      client.release();
      console.log('✅ Test database connection established');

      // Initialize OpenAI service first
      await openAIService.initialize();
      console.log('✅ OpenAI Service initialized');
      
      // Initialize embeddings service with our test pool
      this.embeddingsService = new EmbeddingsService(openAIService, this.dbPool);
      await this.embeddingsService.initialize();
      console.log('✅ Embeddings Service initialized');
      
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize services:', error.message);
      return false;
    }
  }

  async testServiceHealth() {
    const health = await this.embeddingsService.healthCheck();
    if (health.status !== 'healthy') {
      throw new Error(`Service unhealthy: ${health.error || 'Unknown error'}`);
    }
    console.log(`   Service status: ${health.status}`);
    console.log(`   Response time: ${health.responseTime}ms`);
    console.log(`   Available models: ${health.availableModels}`);
  }

  async testModelsInfo() {
    const models = this.embeddingsService.getModelsInfo();
    if (!Array.isArray(models) || models.length === 0) {
      throw new Error('No models available');
    }
    
    const expectedModels = ['text-embedding-3-small', 'text-embedding-3-large', 'text-embedding-ada-002'];
    for (const expectedModel of expectedModels) {
      const found = models.find(m => m.id === expectedModel);
      if (!found) {
        throw new Error(`Model ${expectedModel} not found`);
      }
    }
    
    console.log(`   Available models: ${models.length}`);
    models.forEach(model => {
      console.log(`   - ${model.id}: ${model.dimensions}d, $${model.costPer1kTokens}/1k tokens`);
    });
  }

  async testSingleTextEmbedding() {
    const text = "Hello, this is a test sentence for embedding generation.";
    
    const result = await this.embeddingsService.createEmbedding(text, {
      model: 'text-embedding-3-small',
      useCache: false
    });
    
    if (!result.success) {
      throw new Error(`Embedding failed: ${result.error}`);
    }
    
    const embedding = result.data;
    if (!Array.isArray(embedding) || embedding.length === 0) {
      throw new Error('Invalid embedding format');
    }
    
    console.log(`   Text: "${text}"`);
    console.log(`   Model: text-embedding-3-small`);
    console.log(`   Dimensions: ${embedding.length}`);
    console.log(`   Sample values: [${embedding.slice(0, 5).map(n => n.toFixed(4)).join(', ')}...]`);
  }

  async testBatchEmbeddings() {
    const texts = [
      "The quick brown fox jumps over the lazy dog.",
      "Python is a programming language.",
      "Machine learning is fascinating.",
      "OpenAI creates artificial intelligence models.",
      "Text embeddings represent semantic meaning."
    ];
    
    const result = await embeddingsService.createEmbedding(texts, {
      model: 'text-embedding-3-small',
      useCache: false
    });
    
    if (!result.data || result.data.length !== texts.length) {
      throw new Error(`Expected ${texts.length} embeddings, got ${result.data?.length}`);
    }
    
    // Verify each embedding
    for (let i = 0; i < texts.length; i++) {
      const embedding = result.data[i];
      if (!Array.isArray(embedding.embedding) || embedding.embedding.length !== 1536) {
        throw new Error(`Embedding ${i} has invalid dimensions: ${embedding.embedding?.length}`);
      }
      
      if (embedding.text !== texts[i]) {
        throw new Error(`Text mismatch at index ${i}`);
      }
    }
    
    console.log(`   Processed ${texts.length} texts`);
    console.log(`   Total tokens: ${result.usage.total_tokens}`);
    console.log(`   Cache efficiency: ${result.metadata.cacheEfficiency}%`);
    console.log(`   Duration: ${result.metadata.duration}ms`);
  }

  async testDifferentModels() {
    const text = "This is a test for comparing different embedding models.";
    const models = ['text-embedding-3-small', 'text-embedding-3-large'];
    const results = {};
    
    for (const model of models) {
      const result = await embeddingsService.createEmbedding(text, {
        model,
        useCache: false
      });
      
      const embedding = result.data[0];
      results[model] = {
        dimensions: embedding.dimensions,
        tokenCount: embedding.tokenCount,
        duration: result.metadata.duration,
        cost: result.metadata.estimatedCost
      };
      
      console.log(`   ${model}:`);
      console.log(`     Dimensions: ${embedding.dimensions}`);
      console.log(`     Token count: ${embedding.tokenCount}`);
      console.log(`     Duration: ${result.metadata.duration}ms`);
      console.log(`     Estimated cost: $${result.metadata.estimatedCost.toFixed(8)}`);
    }
    
    // Verify dimensions match expectations
    if (results['text-embedding-3-small'].dimensions !== 1536) {
      throw new Error('text-embedding-3-small should have 1536 dimensions');
    }
    
    if (results['text-embedding-3-large'].dimensions !== 3072) {
      throw new Error('text-embedding-3-large should have 3072 dimensions');
    }
  }

  async testCustomDimensions() {
    const text = "Testing custom dimensions with text-embedding-3-small";
    const customDimensions = 512;
    
    const result = await embeddingsService.createEmbedding(text, {
      model: 'text-embedding-3-small',
      dimensions: customDimensions,
      useCache: false
    });
    
    const embedding = result.data[0];
    if (embedding.embedding.length !== customDimensions) {
      throw new Error(`Expected ${customDimensions} dimensions, got ${embedding.embedding.length}`);
    }
    
    console.log(`   Custom dimensions: ${customDimensions}`);
    console.log(`   Actual dimensions: ${embedding.embedding.length}`);
    console.log(`   Model: ${embedding.model}`);
  }

  async testCaching() {
    const text = "This text should be cached for faster subsequent requests.";
    
    // First request (should miss cache)
    const result1 = await embeddingsService.createEmbedding(text, {
      model: 'text-embedding-3-small',
      useCache: true
    });
    
    // Second request (should hit cache)
    const result2 = await embeddingsService.createEmbedding(text, {
      model: 'text-embedding-3-small',
      useCache: true
    });
    
    const embedding1 = result1.data[0];
    const embedding2 = result2.data[0];
    
    if (embedding1.fromCache === true) {
      console.log('   Note: Text may have been cached from previous runs');
    }
    
    if (!embedding2.fromCache) {
      throw new Error('Second request should have used cache');
    }
    
    // Embeddings should be identical
    if (JSON.stringify(embedding1.embedding) !== JSON.stringify(embedding2.embedding)) {
      throw new Error('Cached embedding differs from original');
    }
    
    console.log(`   First request cache: ${embedding1.fromCache}`);
    console.log(`   Second request cache: ${embedding2.fromCache}`);
    console.log(`   Cache efficiency: ${result2.metadata.cacheEfficiency}%`);
  }

  async testSimilarityCalculation() {
    const texts = [
      "Dogs are loyal pets",
      "Cats are independent animals", 
      "Cars are vehicles with engines",
      "Puppies are young dogs"
    ];
    
    // Generate embeddings
    const result = await embeddingsService.createEmbedding(texts, {
      model: 'text-embedding-3-small',
      useCache: false
    });
    
    // Calculate similarities between "Dogs are loyal pets" and others
    const queryEmbedding = result.data[0].embedding;
    const similarities = [];
    
    for (let i = 1; i < result.data.length; i++) {
      const similarity = embeddingsService.calculateCosineSimilarity(
        queryEmbedding,
        result.data[i].embedding
      );
      similarities.push({
        text: texts[i],
        similarity
      });
    }
    
    // Sort by similarity
    similarities.sort((a, b) => b.similarity - a.similarity);
    
    console.log(`   Query: "${texts[0]}"`);
    console.log('   Similarities:');
    similarities.forEach((item, index) => {
      console.log(`     ${index + 1}. "${item.text}": ${item.similarity.toFixed(4)}`);
    });
    
    // "Puppies are young dogs" should be most similar to "Dogs are loyal pets"
    const mostSimilar = similarities[0];
    if (!mostSimilar.text.includes('Puppies')) {
      console.log('   Warning: Expected "Puppies are young dogs" to be most similar');
    }
    
    // All similarities should be between -1 and 1
    for (const item of similarities) {
      if (item.similarity < -1 || item.similarity > 1) {
        throw new Error(`Invalid similarity score: ${item.similarity}`);
      }
    }
  }

  async testBulkProcessing() {
    // Generate test data
    const inputs = [];
    for (let i = 0; i < 25; i++) {
      inputs.push({
        id: `test_${i}`,
        text: `This is test sentence number ${i} for bulk processing evaluation.`,
        metadata: { index: i, category: i % 3 === 0 ? 'A' : i % 3 === 1 ? 'B' : 'C' }
      });
    }
    
    // Process in bulk
    const startTime = Date.now();
    const results = [];
    const batchSize = 10;
    
    for (let i = 0; i < inputs.length; i += batchSize) {
      const batch = inputs.slice(i, i + batchSize);
      const batchTexts = batch.map(input => input.text);
      
      const batchResult = await embeddingsService.createEmbedding(batchTexts, {
        model: 'text-embedding-3-small',
        useCache: false
      });
      
      batch.forEach((input, index) => {
        const embeddingData = batchResult.data[index];
        results.push({
          id: input.id,
          text: input.text,
          embedding: embeddingData.embedding,
          metadata: input.metadata
        });
      });
    }
    
    const duration = Date.now() - startTime;
    
    if (results.length !== inputs.length) {
      throw new Error(`Expected ${inputs.length} results, got ${results.length}`);
    }
    
    console.log(`   Processed ${inputs.length} items in batches of ${batchSize}`);
    console.log(`   Total duration: ${duration}ms`);
    console.log(`   Average per item: ${(duration / inputs.length).toFixed(2)}ms`);
    console.log(`   Embeddings generated: ${results.length}`);
  }

  async testCacheStats() {
    const stats = await embeddingsService.getCacheStats();
    
    console.log('   Cache Statistics:');
    console.log(`     Total entries: ${stats.total.entries}`);
    console.log(`     Storage estimate: ${Math.round(stats.total.storageBytesEstimate / 1024)}KB`);
    
    if (stats.byModel.length > 0) {
      console.log('     By model:');
      stats.byModel.forEach(modelStats => {
        console.log(`       ${modelStats.model}: ${modelStats.cachedCount} entries, ${modelStats.totalAccesses} accesses`);
      });
    }
  }

  async cleanup() {
    if (this.dbPool) {
      await this.dbPool.end();
    }
  }

  printSummary() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 EMBEDDINGS TEST RESULTS');
    console.log('='.repeat(60));
    console.log(`Total Tests: ${this.results.total}`);
    console.log(`Passed: ${this.results.passed} ✅`);
    console.log(`Failed: ${this.results.failed} ❌`);
    console.log(`Success Rate: ${((this.results.passed / this.results.total) * 100).toFixed(1)}%`);
    
    if (this.results.errors.length > 0) {
      console.log('\n❌ FAILED TESTS:');
      this.results.errors.forEach((error, index) => {
        console.log(`${index + 1}. ${error.test}: ${error.error}`);
      });
    }
    
    console.log('\n' + '='.repeat(60));
    
    return this.results.failed === 0;
  }
}

// Main test execution
async function runEmbeddingsTests() {
  const testSuite = new EmbeddingsTestSuite();
  
  // Initialize services
  const initialized = await testSuite.initialize();
  if (!initialized) {
    process.exit(1);
  }
  
  // Run all tests
  await testSuite.runTest('Service Health Check', () => testSuite.testServiceHealth());
  await testSuite.runTest('Models Information', () => testSuite.testModelsInfo());
  await testSuite.runTest('Single Text Embedding', () => testSuite.testSingleTextEmbedding());
  await testSuite.runTest('Batch Embeddings', () => testSuite.testBatchEmbeddings());
  await testSuite.runTest('Different Models', () => testSuite.testDifferentModels());
  await testSuite.runTest('Custom Dimensions', () => testSuite.testCustomDimensions());
  await testSuite.runTest('Caching Mechanism', () => testSuite.testCaching());
  await testSuite.runTest('Similarity Calculation', () => testSuite.testSimilarityCalculation());
  await testSuite.runTest('Bulk Processing', () => testSuite.testBulkProcessing());
  await testSuite.runTest('Cache Statistics', () => testSuite.testCacheStats());
  
  // Print summary
  const success = testSuite.printSummary();
  
  // Cleanup
  await testSuite.cleanup();
  
  process.exit(success ? 0 : 1);
}

// Auto-run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runEmbeddingsTests().catch(error => {
    console.error('💥 Test suite failed to run:', error);
    process.exit(1);
  });
}

export { runEmbeddingsTests, EmbeddingsTestSuite };