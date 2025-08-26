import express from 'express';
import authenticateToken from '../middleware/authenticateToken.js';
import OpenTelemetryTracing from '../system/OpenTelemetryTracing.js';
import HFRouter from '../modelRouting/HuggingFaceRouterService.js';
import EnhancedKnowledgeHub from '../services/EnhancedKnowledgeHub.js';

const router = express.Router();

// Lazy-init singleton for Knowledge Hub (RAG/search)
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

// Router health endpoint
router.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'operational',
    service: 'router',
    timestamp: new Date().toISOString(),
  });
});

router.post('/', authenticateToken, async (req, res) => {
  const started = Date.now();
  const body = req.body || {};
  const task = String(body.task || 'chat');
  const prompt = body.prompt || body.query || '';
  const documents = Array.isArray(body.documents) ? body.documents : undefined;
  const options = body.options || {};

  try {
    const result = await OpenTelemetryTracing.traceOperation(
      'cartrita.router',
      { attributes: { 'router.task': task } },
      async () => {
        // For first pass, reuse HF router for chat/embedding/rerank-like tasks
        if (
          [
            'chat',
            'embedding',
            'rerank',
            'classification',
            'multilingual',
            'general',
            'tool_use',
          ].includes(task)
        ) {
          const routed = await HFRouter.route(prompt, {
            ...options,
            documents,
          });
          return { provider: 'huggingface', ...routed };
        }
        // Knowledge search via EnhancedKnowledgeHub
        if (task === 'search') {
          // Test stub: in LIGHTWEIGHT_TEST mode, bypass KH and return deterministic payload
          if (process.env.LIGHTWEIGHT_TEST === '1') {
            const {
              limit = 10,
              threshold = 0.7,
              documentIds = null,
            } = options || {};
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
                results: results.slice(
                  0,
                  Math.max(1, Math.min(limit, results.length))
                ),
                resultCount: Math.min(limit, results.length),
                processingTime: 1,
                threshold,
              },
            };
          }
          const hub = ensureKnowledgeHub();
          if (khInitPromise) await khInitPromise;
          if (!hub || !hub.ready || hub.disabled) {
            const reason = !hub
              ? 'not_initialized'
              : hub.disabled
                ? 'disabled'
                : 'not_ready';
            const err = new Error(`Knowledge Hub ${reason}`);
            err.statusCode = 503;
            throw err;
          }
          const {
            limit = 10,
            threshold = 0.7,
            documentIds = null,
          } = options || {};
          const userId = req.user?.id;
          const searchRes = await hub.semanticSearch(
            userId,
            String(prompt || ''),
            { limit, threshold, documentIds }
          );
          return { provider: 'knowledge', task: 'search', result: searchRes };
        }
        // RAG pipeline: search then synthesize
        if (task === 'rag') {
          // Test stub: in LIGHTWEIGHT_TEST mode, bypass KH and return deterministic payload
          if (process.env.LIGHTWEIGHT_TEST === '1') {
            const { includeReferences = true, model = 'test-model' } =
              options || {};
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
            const reason = !hub
              ? 'not_initialized'
              : hub.disabled
                ? 'disabled'
                : 'not_ready';
            const err = new Error(`Knowledge Hub ${reason}`);
            err.statusCode = 503;
            throw err;
          }
          const userId = req.user?.id;
          const {
            searchLimit = 8,
            searchThreshold = 0.7,
            includeReferences = true,
            model,
            maxTokens,
          } = options || {};
          // If caller already provided results, use them; else perform search first
          let results = Array.isArray(options?.searchResults)
            ? options.searchResults
            : null;
          if (!results) {
            const s = await hub.semanticSearch(userId, String(prompt || ''), {
              limit: searchLimit,
              threshold: searchThreshold,
            });
            results = s?.results || [];
          }
          const ragRes = await hub.generateRAGResponse(
            userId,
            String(prompt || ''),
            results,
            { includeReferences, model, maxTokens }
          );
          return { provider: 'knowledge', task: 'rag', result: ragRes };
        }
        // Default fallback
        const routed = await HFRouter.route(prompt, { ...options, documents });
        return { provider: 'huggingface', ...routed };
      }
    );

    res.json({
      success: true,
      task,
      ...result,
      timing_ms: Date.now() - started,
    });
  } catch (e) {
    const code = e?.statusCode || 500;
    res
      .status(code)
      .json({
        success: false,
        error: e.message,
        task,
        timing_ms: Date.now() - started,
      });
  }
});

export default router;
