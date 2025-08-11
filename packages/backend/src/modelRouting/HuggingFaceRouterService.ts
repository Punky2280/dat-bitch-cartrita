import fs from 'fs';
import path from 'path';
import axios, { AxiosRequestConfig } from 'axios';
const OpenTelemetryTracing = require('../system/OpenTelemetryTracing.js').default;

export interface ModelEntry {
  idx: number;
  repo_id: string;
  category: string;
  approx_params: string;
  primary_tasks: string[];
  serverless_candidate: boolean;
  requires_endpoint: boolean;
  notes: string;
  cost_tier?: string;
  quality_score?: number;
  context_length?: number;
}

export interface RouteConstraints {
  documents?: string[];
  max_candidates?: number;
  temperature?: number;
  max_new_tokens?: number;
  taskOverride?: string;
  budget_tier?: 'economy' | 'standard' | 'premium';
  max_cost_per_1k_tokens?: number;
  min_confidence_threshold?: number;
  require_safety_filter?: boolean;
  context_length_needed?: number;
  multilingual?: boolean;
  enable_fallback?: boolean;
}

export interface RouteResult {
  model_id: string;
  output: any;
  used_fallbacks: number;
  task: string;
  timing_ms: number;
  confidence: number;
  candidates_considered: string[];
  estimated_cost?: number;
  detected_language?: string;
  safety_checked?: boolean;
  cost_tier?: string;
  context_used?: number;
  tokens_generated?: number;
}

// Load enhanced catalog with cost tiers and quality scores
// Try enhanced catalog first, fallback to original
let catalogPath = path.join(process.cwd(), 'packages/backend/src/modelRouting/hfModelCatalogEnhanced.json');
if (!fs.existsSync(catalogPath)) {
  catalogPath = path.join(process.cwd(), 'packages/backend/src/modelRouting/hfModelCatalog.json');
}
if (!fs.existsSync(catalogPath)) {
  // Try when cwd is already packages/backend
  const alt = path.join(process.cwd(), 'src/modelRouting/hfModelCatalogEnhanced.json');
  if (fs.existsSync(alt)) {
    catalogPath = alt;
  } else {
    const altOrig = path.join(process.cwd(), 'src/modelRouting/hfModelCatalog.json');
    if (fs.existsSync(altOrig)) catalogPath = altOrig;
  }
}
const MODEL_CATALOG: ModelEntry[] = JSON.parse(fs.readFileSync(catalogPath, 'utf-8'));
const CATALOG_BY_ID: Record<string, ModelEntry> = Object.fromEntries(MODEL_CATALOG.map(m => [m.repo_id, m]));

const HF_BASE = 'https://api-inference.huggingface.co';
const HF_TOKEN = process.env.HF_TOKEN || '';

const SESSION = axios.create({
  baseURL: HF_BASE,
  timeout: 90_000
});
if (HF_TOKEN) {
  SESSION.defaults.headers.common['Authorization'] = `Bearer ${HF_TOKEN}`;
}

// Adaptive stats
const latencyMs: Map<string, number> = new Map();
const success: Map<string, number> = new Map();
const errors: Map<string, number> = new Map();

function ewmaLatency(id: string, val: number) {
  const prev = latencyMs.get(id) ?? val;
  latencyMs.set(id, 0.3 * val + 0.7 * prev);
}
function recordOutcome(id: string, ok: boolean) {
  success.set(id, (success.get(id) ?? 0) + (ok ? 1 : 0));
  errors.set(id, (errors.get(id) ?? 0) + (ok ? 0 : 1));
  try {
    if (ok) (global as any).otelCounters?.hfRoutingSuccess?.add(1, { model: id });
    else (global as any).otelCounters?.hfRoutingErrors?.add(1, { model: id });
  } catch(_) {}
}
function reliability(id: string) {
  const s = success.get(id) ?? 1;
  const e = errors.get(id) ?? 0;
  const t = s + e;
  return t === 0 ? 0.5 : s / t;
}
function latencyScore(id: string) {
  const l = latencyMs.get(id) ?? 3000;
  return Math.max(0, Math.min(1, 1 - l / 4000));
}
function qualityPrior(m: ModelEntry): number {
  const s = m.approx_params;
  if (s.includes('70B') || s.includes('72B')) return 0.95;
  if (['33B','34B','35B'].some(x=>s.includes(x))) return 0.85;
  if (['20B','22B','32B'].some(x=>s.includes(x))) return 0.8;
  if (['14B','15B','13B','12B','10.7B'].some(x=>s.includes(x))) return 0.75;
  if (['9B','8B','7B','6B'].some(x=>s.includes(x))) return 0.65;
  if (['3.3B','3B','2.7B','2B','1.6B','1.3B','1.1B'].some(x=>s.includes(x))) return 0.55;
  if (['small','nano','MiniLM','124M'].some(x=>s.includes(x))) return 0.5;
  return 0.55;
}
function costScore(m: ModelEntry): number {
  const s = m.approx_params;
  if (['70B','72B','33B','34B','35B'].some(x=>s.includes(x))) return 0.3;
  if (['14B','15B','13B','12B','10.7B'].some(x=>s.includes(x))) return 0.55;
  if (['9B','8B','7B','6B'].some(x=>s.includes(x))) return 0.7;
  if (['3.3B','3B','2.7B','2B','1.6B','1.3B','1.1B','small','nano'].some(x=>s.includes(x))) return 0.85;
  return 0.6;
}
function composite(m: ModelEntry) {
  const q = qualityPrior(m);
  const l = latencyScore(m.repo_id);
  const c = costScore(m);
  const r = reliability(m.repo_id);
  return 0.5 * q + 0.2 * l + 0.2 * c + 0.1 * r;
}

const TASK_KEYWORDS: Record<string,string[]> = {
  code: ['def ','class ','import ','bug','compile','refactor'],
  math: ['solve','equation','integral','theorem','proof','derivative'],
  multilingual: ['translate','traduce','übersetze','traduire','翻译','traducción'],
  long_context: ['summary','summarize','minutes','transcript','long document'],
  embedding: ['semantic search','embedding','vectorize'],
  rerank: ['rerank','re-rank'],
  tool_use: ['function call','tool:','api schema'],
  vision_language: ['image:','diagram','figure','chart','ocr'],
  audio: ['audio:','asr','speech','transcribe'],
  safety: ['moderate this','safety check'],
  general: []
};

function classify(prompt: string): string {
  const low = prompt.toLowerCase();
  for (const [task, kws] of Object.entries(TASK_KEYWORDS)) {
    if (kws.some(k => low.includes(k))) return task;
  }
  return 'general';
}

function shortlist(task: string, max = 6): ModelEntry[] {
  let candidates = MODEL_CATALOG.filter(m => {
    if (task === 'general') return ['general','lightweight'].includes(m.category);
    if (task === 'embedding') return ['embedding','rerank'].includes(m.category);
    if (task === 'rerank') return m.category === 'rerank';
    return m.category === task;
  });
  if (candidates.length === 0) {
    candidates = MODEL_CATALOG.filter(m => ['general','lightweight'].includes(m.category));
  }
  return candidates.sort((a,b)=>composite(b)-composite(a)).slice(0,max);
}

async function probe(repo: string, category: string): Promise<boolean> {
  // Skip heavy modalities to avoid latency; assume available
  if (['vision_language','audio'].includes(category)) return true;
  const url = `/models/${repo}`;
  const payload: any = {};
  if (category === 'embedding' || category === 'rerank') {
    payload.inputs = 'probe';
  } else if (category === 'safety') {
    payload.inputs = 'Safety probe content.';
  } else {
    payload.inputs = 'Health check. Reply OK.';
  }
  const start = Date.now();
  try {
    const res = await SESSION.post(url, payload, { timeout: 6000 });
    ewmaLatency(repo, Date.now() - start);
    recordOutcome(repo, res.status === 200);
    return res.status === 200;
  } catch(_) {
    recordOutcome(repo, false);
    return false;
  }
}

// Enhanced confidence scoring with multiple signals
function confidenceHeuristic(output: string, taskType?: string): number {
  if (!output) return 0;
  
  const len = output.trim().length;
  const words = output.split(/\s+/);
  const uniqueTokens = new Set(words).size;
  
  // Base length scoring
  let lengthScore = 0;
  if (len < 16) lengthScore = 0.1;
  else if (len < 40) lengthScore = 0.25;
  else if (len < 120) lengthScore = 0.55;
  else lengthScore = 0.7;
  
  // Diversity metric
  const diversity = uniqueTokens / Math.max(1, words.length);
  
  // Refusal detection (low confidence indicators)
  const refusalPatterns = /sorry|cannot|unable|don't know|not sure|unclear|uncertain/i;
  const hasRefusal = refusalPatterns.test(output);
  const refusalPenalty = hasRefusal ? 0.3 : 0;
  
  // Task-specific adjustments
  let taskAdjustment = 0;
  if (taskType === 'code') {
    // Code should have structure
    const hasCodeBlocks = output.includes('```') || output.includes('def ') || output.includes('function ');
    taskAdjustment = hasCodeBlocks ? 0.1 : -0.2;
  } else if (taskType === 'math') {
    // Math should have numbers or mathematical symbols
    const hasMathContent = /\d+|[+\-*/=<>]|\b(equation|formula|calculate)\b/i.test(output);
    taskAdjustment = hasMathContent ? 0.1 : -0.2;
  } else if (taskType === 'translation') {
    // Translation should be concise and focused
    taskAdjustment = len > 500 ? -0.1 : 0.05;
  }
  
  // Combine all signals
  const baseConfidence = 0.4 * lengthScore + 0.3 * diversity + 0.3 * (1 - refusalPenalty);
  return Math.max(0, Math.min(1, baseConfidence + taskAdjustment));
}

// Cost estimation based on token count and model tier
function estimateCost(promptTokens: number, completionTokens: number, model: ModelEntry): number {
  const costPerToken = {
    'economy': 0.0001,
    'standard': 0.0005,
    'premium': 0.002
  };
  
  const tier = model.cost_tier || 'standard';
  const rate = costPerToken[tier as keyof typeof costPerToken];
  return (promptTokens + completionTokens) * rate;
}

// Safety filtering using multiple classifiers
async function safetyFilter(text: string): Promise<{ safe: boolean; risk_categories: string[]; confidence: number }> {
  // Simple pattern-based safety check (replace with actual models in production)
  const riskPatterns = {
    'violence': /\b(kill|murder|harm|weapon|violence|attack)\b/i,
    'hate': /\b(hate|racist|discriminat|bigot)\b/i,
    'sexual': /\b(sexual|explicit|adult|nsfw)\b/i,
    'self-harm': /\b(suicide|self.?harm|cutting)\b/i,
    'illegal': /\b(drugs|illegal|criminal|fraud)\b/i
  };
  
  const risks: string[] = [];
  let maxRiskScore = 0;
  
  for (const [category, pattern] of Object.entries(riskPatterns)) {
    if (pattern.test(text)) {
      risks.push(category);
      maxRiskScore = Math.max(maxRiskScore, 0.8);
    }
  }
  
  return {
    safe: risks.length === 0,
    risk_categories: risks,
    confidence: Math.max(0.6, 1 - maxRiskScore)
  };
}

// Language detection for multilingual routing
function detectLanguage(text: string): string {
  // Simple heuristic language detection (replace with proper library)
  const patterns = {
    'zh': /[\u4e00-\u9fff]/,
    'ja': /[\u3040-\u309f\u30a0-\u30ff]/,
    'ko': /[\uac00-\ud7af]/,
    'ar': /[\u0600-\u06ff]/,
    'ru': /[\u0400-\u04ff]/,
    'es': /\b(el|la|los|las|un|una|y|o|pero|que|de|en|con)\b/,
    'fr': /\b(le|la|les|un|une|et|ou|mais|que|de|dans|avec)\b/,
    'de': /\b(der|die|das|ein|eine|und|oder|aber|dass|von|in|mit)\b/
  };
  
  for (const [lang, pattern] of Object.entries(patterns)) {
    if (pattern.test(text)) {
      return lang;
    }
  }
  return 'en';
}

async function generate(model: string, prompt: string, params: { max_new_tokens?: number; temperature?: number } = {}) {
  const body = {
    inputs: prompt,
    parameters: {
      max_new_tokens: params.max_new_tokens ?? 512,
      temperature: params.temperature ?? 0.7,
      return_full_text: false
    }
  };
  const start = Date.now();
  try {
    const res = await SESSION.post(`/models/${model}`, body);
    ewmaLatency(model, Date.now() - start);
    recordOutcome(model, res.status === 200);
    if (!res.data) throw new Error('No data');
    if (Array.isArray(res.data) && res.data[0]?.generated_text) return String(res.data[0].generated_text);
    return typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
  } catch (e:any) {
    recordOutcome(model, false);
    throw e;
  }
}

async function embed(model: string, text: string) {
  const start = Date.now();
  const body = { inputs: text };
  const res = await SESSION.post(`/models/${model}`, body);
  ewmaLatency(model, Date.now() - start);
  recordOutcome(model, res.status === 200);
  const d = res.data;
  if (Array.isArray(d) && Array.isArray(d[0])) return d[0];
  if (d?.embedding) return d.embedding;
  return d;
}

async function rerank(model: string, query: string, docs: string[]) {
  const pairs = docs.map(d => ({ text: d, query }));
  const start = Date.now();
  const res = await SESSION.post(`/models/${model}`, { inputs: pairs });
  ewmaLatency(model, Date.now() - start);
  recordOutcome(model, res.status === 200);
  const data = res.data;
  const result = data.map((s: any, i: number) => {
    const score = typeof s === 'object' && s.score !== undefined ? s.score : (typeof s === 'number' ? s : 0);
    return { doc: docs[i], score };
  }).sort((a:any,b:any)=>b.score-a.score);
  return result;
}

async function translate(model: string, text: string, src?: string, tgt?: string) {
  const meta = CATALOG_BY_ID[model];
  if (meta?.category === 'multilingual' && meta.primary_tasks.includes('translation')) {
    const res = await SESSION.post(`/models/${model}`, { inputs: text });
    recordOutcome(model, res.status === 200);
    const d = res.data;
    if (Array.isArray(d) && d[0]?.translation_text) return d[0].translation_text;
    return typeof d === 'string' ? d : JSON.stringify(d);
  } else {
    const prompt = `Translate the following text${src?` from ${src}`:''}${tgt?` to ${tgt}`:''}:\n\n${text}\n\nReturn only the translation.`;
    return generate(model, prompt, { max_new_tokens: 256, temperature: 0.2 });
  }
}

export class HuggingFaceRouterService {
  async route(prompt: string, opts: RouteConstraints = {}): Promise<RouteResult> {
    const spanAttrs: any = { 'hf.route.prompt_chars': prompt.length };
    return OpenTelemetryTracing.traceOperation('hf.route_inference', { attributes: spanAttrs }, async () => {
      
      // Safety pre-filtering if required
      if (opts.require_safety_filter) {
        const safetyResult = await safetyFilter(prompt);
        if (!safetyResult.safe) {
          throw new Error(`Safety filter blocked request: ${safetyResult.risk_categories.join(', ')}`);
        }
      }

      // Enhanced task classification with language detection
      const detectedLang = detectLanguage(prompt);
      let task = opts.taskOverride || classify(prompt);
      
      // Adjust task based on language detection
      if (detectedLang !== 'en' && !opts.multilingual) {
        // Force multilingual models for non-English content
        opts.multilingual = true;
      }

      // Get candidates with budget filtering
      let candidates = shortlist(task, opts.max_candidates ?? 8);
      
      // Budget tier filtering
      if (opts.budget_tier) {
        candidates = candidates.filter(m => 
          m.cost_tier === opts.budget_tier || 
          (opts.budget_tier === 'premium' && ['standard', 'economy'].includes(m.cost_tier || 'standard'))
        );
      }
      
      // Context length filtering
      if (opts.context_length_needed) {
        candidates = candidates.filter(m => 
          (m.context_length || 4096) >= opts.context_length_needed!
        );
      }
      
      // Multilingual filtering
      if (opts.multilingual) {
        const multilingualCandidates = candidates.filter(m => 
          m.category === 'multilingual' || 
          m.primary_tasks.includes('multilingual') ||
          m.repo_id.includes('multilingual') ||
          ['Qwen', 'aya', 'nllb', 'm2m'].some(prefix => m.repo_id.includes(prefix))
        );
        if (multilingualCandidates.length > 0) {
          candidates = multilingualCandidates;
        }
      }

      // Probe availability and rank
      const availability: { model: ModelEntry; available: boolean; score: number }[] = [];
      for (const m of candidates) {
        const available = await probe(m.repo_id, m.category);
        const score = composite(m);
        availability.push({ model: m, available, score });
      }
      
      // Sort by availability first, then by score
      const ordered = availability
        .sort((a, b) => {
          if (a.available && !b.available) return -1;
          if (!a.available && b.available) return 1;
          return b.score - a.score;
        })
        .map(a => a.model);

      const startTotal = Date.now();
      let usedFallbacks = 0;
      let lastErr: any = null;
      const estimatedPromptTokens = Math.ceil(prompt.length / 4);
      
      for (const m of ordered) {
        try {
          let output: any;
          let actualOutputTokens = 0;
          
          // Execute the appropriate task
          if (task === 'embedding') {
            output = await embed(m.repo_id, prompt);
          } else if (task === 'rerank') {
            const docs = opts.documents || ['Doc A','Doc B','Doc C'];
            output = await rerank(m.repo_id, prompt, docs);
          } else if (task === 'tool_use') {
            output = await generate(m.repo_id, prompt, { temperature: opts.temperature, max_new_tokens: opts.max_new_tokens });
            actualOutputTokens = typeof output === 'string' ? Math.ceil(output.length / 4) : 0;
          } else if (task === 'multilingual' && prompt.toLowerCase().includes('translate')) {
            output = await translate(m.repo_id, prompt);
            actualOutputTokens = typeof output === 'string' ? Math.ceil(output.length / 4) : 0;
          } else {
            output = await generate(m.repo_id, prompt, { temperature: opts.temperature, max_new_tokens: opts.max_new_tokens });
            actualOutputTokens = typeof output === 'string' ? Math.ceil(output.length / 4) : 0;
          }
          
          // Enhanced confidence scoring
          const conf = typeof output === 'string' ? confidenceHeuristic(output, task) : 0.9;
          const minConfidence = opts.min_confidence_threshold || 0.3;
          
          // Cost check
          const estimatedCost = estimateCost(estimatedPromptTokens, actualOutputTokens, m);
          if (opts.max_cost_per_1k_tokens && estimatedCost > opts.max_cost_per_1k_tokens) {
            console.warn(`Model ${m.repo_id} estimated cost ${estimatedCost} exceeds limit ${opts.max_cost_per_1k_tokens}`);
            if (!opts.enable_fallback) {
              throw new Error(`Cost limit exceeded: ${estimatedCost} > ${opts.max_cost_per_1k_tokens}`);
            }
            usedFallbacks++;
            continue;
          }
          
          // Confidence-based fallback
          if (conf < minConfidence && usedFallbacks < 3 && opts.enable_fallback !== false) {
            console.log(`Model ${m.repo_id} confidence ${conf} below threshold ${minConfidence}, trying fallback`);
            usedFallbacks++;
            (global as any).otelCounters?.hfRoutingFallbacks?.add(1, { reason: 'low_conf', model: m.repo_id });
            continue;
          }
          
          // Safety post-filtering if required
          if (opts.require_safety_filter && typeof output === 'string') {
            const outputSafetyResult = await safetyFilter(output);
            if (!outputSafetyResult.safe) {
              console.warn(`Output from ${m.repo_id} failed safety filter: ${outputSafetyResult.risk_categories.join(', ')}`);
              if (opts.enable_fallback !== false) {
                usedFallbacks++;
                continue;
              }
              throw new Error(`Output safety filter failed: ${outputSafetyResult.risk_categories.join(', ')}`);
            }
          }
          
          // Success! Return result with enhanced metadata
          return {
            model_id: m.repo_id,
            output,
            used_fallbacks: usedFallbacks,
            task,
            timing_ms: Date.now() - startTotal,
            confidence: conf,
            candidates_considered: candidates.map(c => c.repo_id),
            estimated_cost: estimatedCost,
            detected_language: detectedLang,
            safety_checked: opts.require_safety_filter || false,
            cost_tier: m.cost_tier || 'standard',
            context_used: estimatedPromptTokens,
            tokens_generated: actualOutputTokens
          };
          
        } catch(e: any) {
          console.error(`Model ${m.repo_id} failed:`, e.message);
          lastErr = e;
          usedFallbacks++;
          (global as any).otelCounters?.hfRoutingFallbacks?.add(1, { reason: 'error', model: m.repo_id });
          continue;
        }
      }
      
      throw new Error(`All candidates failed after ${usedFallbacks} attempts. Last error: ${lastErr?.message || 'Unknown'}`);
    });
  }

  getCatalog() {
    return MODEL_CATALOG;
  }

  classify(prompt: string) { return classify(prompt); }

  // Expose ranked shortlist (testing / diagnostics)
  shortlist(prompt: string, taskHint?: string, max = 6) {
    const task = taskHint || classify(prompt);
    const list = shortlist(task, max);
    return list.map(m => ({ ...m, compositeScore: composite(m) }));
  }
}

const singleton = new HuggingFaceRouterService();
export default singleton;
