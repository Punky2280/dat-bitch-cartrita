console.log('🔧 [Router] Loading router.js module...');
import express from 'express';
import authenticateToken from '../middleware/authenticateToken.js';
import OpenTelemetryTracing from '../system/OpenTelemetryTracing.js';
import HFRouter from '../modelRouting/HuggingFaceRouterService.js';
import EnhancedKnowledgeHub from '../services/EnhancedKnowledgeHub.js';
import { cartritaRouter, processCartritaRequest } from '../cartrita/router/cartritaRouter.js';
import { Pool } from 'pg';

const router = express.Router();

// Debug endpoint to test router loading
router.get('/debug', async (req, res) => {
  try {
    await initializeCartritaRouter();
    
    const debugInfo = {
      message: 'Cartrita Router is working',
      timestamp: new Date().toISOString(),
      routerInitialized,
      cartritaRouterExists: !!cartritaRouter,
      environmentKeys: {
        openai: !!process.env.OPENAI_API_KEY,
        huggingface: !!process.env.HF_TOKEN,
        deepgram: !!process.env.DEEPGRAM_API_KEY
      }
    };

    if (cartritaRouter && routerInitialized) {
      try {
        debugInfo.availableProviders = {
          chat: cartritaRouter.getAvailableProviders('chat'),
          embedding: cartritaRouter.getAvailableProviders('embedding')
        };
      } catch (err) {
        debugInfo.providerDetectionError = err.message;
      }
    }

    res.json(debugInfo);
  } catch (error) {
    res.status(500).json({ 
      error: 'Debug endpoint failed', 
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Initialize Cartrita Router with database pool
let routerInitialized = false;
const initializeCartritaRouter = async () => {
  if (!routerInitialized) {
    console.log('🔧 Initializing Cartrita Router...');
    try {
      if (!cartritaRouter) {
        console.error('❌ [Router] cartritaRouter is null/undefined!');
        return;
      }
      
      const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      });
      console.log('🔧 Database pool created, initializing router...');
      await cartritaRouter.initialize(pool);
      routerInitialized = true;
      console.log('✅ Cartrita Router initialized with database connection');
    } catch (error) {
      console.warn('[Router] Cartrita Router init failed:', error.message);
      console.error('[Router] Full error:', error);
    }
  } else {
    console.log('🔧 [Router] Cartrita Router already initialized');
  }
};

// Lazy-init singleton for Knowledge Hub (RAG/search) - legacy fallback
let KH = null;
let khInitPromise = null;
function ensureKnowledgeHub() {
  if (!KH) {
    KH = new EnhancedKnowledgeHub();
    khInitPromise = KH.initialize().catch(err => {
      console.warn('[Router] Knowledge Hub init failed:', err?.message || err);
      return false;
    });
  }
  return KH;
}

// Contract:
// Input: { task: 'chat'|'search'|'rag'|'embedding'|'classify'|'vision'|'audio_transcribe', prompt?, query?, documents?, options? }
// Output: { success, task, provider, model_id?, result, timing_ms, confidence? }

router.post('/', async (req, res) => {
  const started = Date.now();
  const body = req.body || {};
  
  console.log('🔧 [Router] POST request received, initializing Cartrita Router...');
  console.log('🔧 [Router] Current routerInitialized status:', routerInitialized);
  
  // Initialize Cartrita Router if not done
  await initializeCartritaRouter();
  
  console.log(`🔧 [Router] Router initialized status after init: ${routerInitialized}`);
  
  try {
    // Prepare Cartrita Router request
    const cartritaRequest = {
      task: String(body.task || 'chat'),
      input: body.input || body.prompt || body.query || '',
      providerId: body.providerId || body.provider,
      userId: req.user?.id,
      options: {
        ...body.options,
        modelHint: body.model || body.modelHint,
        temperature: body.temperature,
        max_tokens: body.max_tokens,
        documents: body.documents
      },
      traceId: body.traceId
    };

    // LIGHTWEIGHT_TEST handling for 'search' and 'rag' tasks
    const { task, query, options = {} } = req.body || {};
    if (process.env.LIGHTWEIGHT_TEST === '1') {
      if (task === 'search') {
        // Preserve existing lightweight search behavior, echoing options where relevant.
        const { threshold, documentIds } = options || {};
        return res.status(200).json({
          success: true,
          task: 'search',
          provider: 'knowledge',
          result: {
            success: true,
            results: [
              {
                id: 'stub-doc-1',
                text: `Stubbed search result for: ${query || ''}`,
                similarity: 0.9,
                document_metadata: {
                  stub: true,
                  threshold,
                  documentIds,
                },
              },
            ],
          },
        });
      }

      if (task === 'rag') {
        // New: stubbed RAG response for lightweight tests
        const includeReferences = !!options.includeReferences;
        return res.status(200).json({
          success: true,
          task: 'rag',
          provider: 'knowledge',
          result: {
            success: true,
            response: `Stub RAG answer: ${query || ''}`.trim(),
            references: includeReferences
              ? [
                  {
                    id: 'stub-ref-1',
                    title: 'Stub Reference',
                    score: 0.88,
                  },
                ]
              : [],
          },
        });
      }
    }

    // Use enhanced Cartrita Router if available, fallback to legacy logic
    let result;
    if (routerInitialized) {
      result = await OpenTelemetryTracing.traceOperation('cartrita.router', 
        { attributes: { 'router.task': cartritaRequest.task, 'router.provider': cartritaRequest.providerId } }, 
        async () => {
          return await processCartritaRequest(cartritaRequest);
        }
      );
    } else {
      // Legacy fallback logic
      result = await OpenTelemetryTracing.traceOperation('cartrita.router', { attributes: { 'router.task': cartritaRequest.task } }, async () => {
        const task = cartritaRequest.task;
        const prompt = cartritaRequest.input;
        const options = cartritaRequest.options;
        
        // For first pass, reuse HF router for chat/embedding/rerank-like tasks
        if (['chat','embedding','rerank','classification','multilingual','general','tool_use'].includes(task)) {
          const routed = await HFRouter.route(prompt, { ...options, documents: options.documents });
          return { provider: 'huggingface', ...routed };
        }
        
        // Knowledge search via EnhancedKnowledgeHub
        if (task === 'search') {
        // Test stub: in LIGHTWEIGHT_TEST mode, bypass KH and return deterministic payload
        if (process.env.LIGHTWEIGHT_TEST === '1') {
          const { limit = 10, threshold = 0.7, documentIds = null } = options || {};
          const results = [
            {
              chunk_id: 1,
              chunk_text: `Stub snippet for: ${String(prompt || '').slice(0, 60)}`,
              chunk_index: 0,
              document_id: 101,
              document_title: 'Stub Document',
              file_type: 'text/plain',
              document_metadata: { stub: true, documentIds },
              similarity: 0.95,
            },
          ];
          return {
            provider: 'knowledge',
            task: 'search',
            result: {
              success: true,
              query: String(prompt || ''),
              results: results.slice(0, Math.max(1, Math.min(limit, results.length))),
              resultCount: Math.min(limit, results.length),
              processingTime: 1,
              threshold,
            },
          };
        }
        const hub = ensureKnowledgeHub();
        if (khInitPromise) await khInitPromise;
        if (!hub || !hub.ready || hub.disabled) {
          const reason = !hub ? 'not_initialized' : hub.disabled ? 'disabled' : 'not_ready';
          const err = new Error(`Knowledge Hub ${reason}`);
          err.statusCode = 503;
          throw err;
        }
        const { limit = 10, threshold = 0.7, documentIds = null } = options || {};
        const userId = req.user?.id;
        const searchRes = await hub.semanticSearch(userId, String(prompt || ''), { limit, threshold, documentIds });
        return { provider: 'knowledge', task: 'search', result: searchRes };
      }
      // RAG pipeline: search then synthesize
      if (task === 'rag') {
        // Test stub: in LIGHTWEIGHT_TEST mode, bypass KH and return deterministic payload
        if (process.env.LIGHTWEIGHT_TEST === '1') {
          const { includeReferences = true, model = 'test-model' } = options || {};
          const results = [
            {
              chunk_id: 1,
              chunk_text: `Stub chunk answering: ${String(prompt || '').slice(0, 60)}`,
              chunk_index: 0,
              document_id: 101,
              document_title: 'Stub Document',
              similarity: 0.93,
            },
          ];
          return {
            provider: 'knowledge',
            task: 'rag',
            result: {
              success: true,
              response: `Stub RAG answer for: ${String(prompt || '').slice(0, 60)}`,
              references: includeReferences
                ? results.map((r, i) => ({
                    index: i + 1,
                    document_title: r.document_title,
                    document_id: r.document_id,
                    similarity: r.similarity,
                    chunk_text: r.chunk_text,
                  }))
                : [],
              model,
            },
          };
        }
        const hub = ensureKnowledgeHub();
        if (khInitPromise) await khInitPromise;
        if (!hub || !hub.ready || hub.disabled) {
          const reason = !hub ? 'not_initialized' : hub.disabled ? 'disabled' : 'not_ready';
          const err = new Error(`Knowledge Hub ${reason}`);
          err.statusCode = 503;
          throw err;
        }
        const userId = req.user?.id;
        const { searchLimit = 8, searchThreshold = 0.7, includeReferences = true, model, maxTokens } = options || {};
        // If caller already provided results, use them; else perform search first
        let results = Array.isArray(options?.searchResults) ? options.searchResults : null;
        if (!results) {
          const s = await hub.semanticSearch(userId, String(prompt || ''), { limit: searchLimit, threshold: searchThreshold });
          results = s?.results || [];
        }
        const ragRes = await hub.generateRAGResponse(userId, String(prompt || ''), results, { includeReferences, model, maxTokens });
        return { provider: 'knowledge', task: 'rag', result: ragRes };
      }
        // Default fallback
        const routed = await HFRouter.route(prompt, { ...options, documents: options.documents });
        return { provider: 'huggingface', ...routed };
      });
    }

    // Determine the task from result
    const taskName = cartritaRequest.task;
    const timing = Date.now() - started;

    // Send response
    res.json({ 
      success: true, 
      task: taskName, 
      ...result, 
      timing_ms: timing 
    });
  } catch (e) {
    const code = e?.statusCode || 500;
    res.status(code).json({ 
      success: false, 
      error: e.message, 
      task: body.task || 'unknown', 
      timing_ms: Date.now() - started 
    });
  }
});

// Get available providers and their capabilities
router.get('/providers', async (req, res) => {
  await initializeCartritaRouter();
  
  try {
    let providers;
    if (routerInitialized) {
      providers = cartritaRouter.getProviders();
    } else {
      // Fallback to static config
      providers = [{
        id: 'huggingface',
        name: 'Hugging Face',
        tasks: ['chat', 'embedding', 'classification'],
        models: { chat: ['auto'], embedding: ['auto'], classification: ['auto'] },
        latencyScore: 0.6,
        reliabilityScore: 0.85
      }];
    }
    
    res.json({
      success: true,
      providers,
      total: providers.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get providers',
      message: error.message
    });
  }
});

// Get providers for specific task
router.get('/providers/task/:task', authenticateToken, async (req, res) => {
  await initializeCartritaRouter();
  
  try {
    const task = req.params.task;
    let providers;
    
    if (routerInitialized) {
      providers = cartritaRouter.getProvidersByTask(task);
    } else {
      // Fallback logic
      providers = task === 'chat' || task === 'embedding' || task === 'classification' ? [{
        id: 'huggingface',
        name: 'Hugging Face',
        tasks: [task],
        models: { [task]: ['auto'] }
      }] : [];
    }
    
    res.json({
      success: true,
      task,
      providers,
      count: providers.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get providers for task',
      message: error.message,
      task: req.params.task
    });
  }
});

// Get router metrics and status
router.get('/metrics', authenticateToken, async (req, res) => {
  await initializeCartritaRouter();
  
  try {
    let metrics;
    if (routerInitialized) {
      metrics = cartritaRouter.getMetrics();
    } else {
      metrics = {
        requestCount: 0,
        errorCount: 0,
        averageLatency: 0,
        providerUsage: {},
        taskDistribution: {},
        uptime: process.uptime(),
        routerStatus: 'legacy_mode'
      };
    }
    
    res.json({
      success: true,
      ...metrics,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get router metrics',
      message: error.message
    });
  }
});

console.log('🔧 [Router] Router module fully loaded and exporting');
export default router;
