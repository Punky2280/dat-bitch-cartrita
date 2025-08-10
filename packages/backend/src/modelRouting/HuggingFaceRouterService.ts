import fs from 'fs';
import path from 'path';
import axios, { AxiosRequestConfig } from 'axios';
import OpenTelemetryTracing from '../system/OpenTelemetryTracing.js';

export interface ModelEntry {
  idx: number;
  repo_id: string;
  category: string;
  approx_params: string;
  primary_tasks: string[];
  serverless_candidate: boolean;
  requires_endpoint: boolean;
  notes: string;
}

export interface RouteConstraints {
  documents?: string[];
  max_candidates?: number;
  temperature?: number;
  max_new_tokens?: number;
  taskOverride?: string;
}

export interface RouteResult {
  model_id: string;
  output: any;
  used_fallbacks: number;
  task: string;
  timing_ms: number;
  confidence: number;
  candidates_considered: string[];
}

// Load catalog once
// Resolve catalog path robustly for monorepo root or backend working dir
let catalogPath = path.join(process.cwd(), 'packages/backend/src/modelRouting/hfModelCatalog.json');
if (!fs.existsSync(catalogPath)) {
  // Try when cwd is already packages/backend
  const alt = path.join(process.cwd(), 'src/modelRouting/hfModelCatalog.json');
  if (fs.existsSync(alt)) catalogPath = alt;
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
    if (ok) global.otelCounters?.hfRoutingSuccess?.add(1, { model: id });
    else global.otelCounters?.hfRoutingErrors?.add(1, { model: id });
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

function confidenceHeuristic(output: string): number {
  if (!output) return 0;
  const len = output.trim().length;
  if (len < 16) return 0.1;
  if (len < 40) return 0.25;
  if (len < 120) return 0.55;
  // crude diversity metric
  const uniqueTokens = new Set(output.split(/\s+/)).size;
  const diversity = uniqueTokens / Math.max(1, output.split(/\s+/).length);
  return Math.min(1, 0.6 + 0.4 * diversity);
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
      const task = opts.taskOverride || classify(prompt);
      const candidates = shortlist(task, opts.max_candidates ?? 8);
      const availability: { model: ModelEntry; available: boolean }[] = [];
      for (const m of candidates) {
        const available = await probe(m.repo_id, m.category);
        availability.push({ model: m, available });
      }
      const ordered = availability.filter(a=>a.available).map(a=>a.model).concat(availability.filter(a=>!a.available).map(a=>a.model));
      const startTotal = Date.now();
      let usedFallbacks = 0;
      let lastErr: any = null;
      for (const m of ordered) {
        try {
          let output: any;
          if (task === 'embedding') {
            output = await embed(m.repo_id, prompt);
          } else if (task === 'rerank') {
            const docs = opts.documents || ['Doc A','Doc B','Doc C'];
            output = await rerank(m.repo_id, prompt, docs);
          } else if (task === 'tool_use') {
            // treat like general generation
            output = await generate(m.repo_id, prompt, { temperature: opts.temperature, max_new_tokens: opts.max_new_tokens });
          } else if (task === 'multilingual' && prompt.toLowerCase().includes('translate')) {
            output = await translate(m.repo_id, prompt);
          } else {
            output = await generate(m.repo_id, prompt, { temperature: opts.temperature, max_new_tokens: opts.max_new_tokens });
          }
          const conf = typeof output === 'string' ? confidenceHeuristic(output) : 0.9;
          if (conf < 0.3 && usedFallbacks < 3) {
            usedFallbacks++;
            global.otelCounters?.hfRoutingFallbacks?.add(1, { reason: 'low_conf', model: m.repo_id });
            continue;
          }
          return {
            model_id: m.repo_id,
            output,
            used_fallbacks: usedFallbacks,
            task,
            timing_ms: Date.now() - startTotal,
            confidence: conf,
            candidates_considered: candidates.map(c=>c.repo_id)
          };
        } catch(e:any) {
          lastErr = e;
          usedFallbacks++;
          global.otelCounters?.hfRoutingFallbacks?.add(1, { reason: 'error', model: m.repo_id });
          continue;
        }
      }
      throw new Error(`All candidates failed. Last: ${lastErr}`);
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
