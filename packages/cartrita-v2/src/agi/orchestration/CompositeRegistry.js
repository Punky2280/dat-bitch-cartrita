// CompositeRegistry: orchestrates phased loading of mini registries.
import { performance } from 'perf_hooks';
import db from '../../db.js';
import { DynamicTool } from '@langchain/core/tools';
import ToolEmbeddingService from './ToolEmbeddingService.js';

export class CompositeRegistry {
  constructor(options = {}) {
    this.tools = new Map();
    this.rawSchemas = new Map();
    this.metrics = { phases: [] };
    this.options = options;
    this.initialized = false;
    this.registerFns = []; // {name, phase, fn}
  this.embeddingService = new ToolEmbeddingService();
  }
  addMiniRegistry(name, phase, fn) {
    this.registerFns.push({ name, phase, fn });
  }
  async initialize() {
    const maxPhase = process.env.REGISTRY_PHASE_MAX !== undefined ? Number(process.env.REGISTRY_PHASE_MAX) : Infinity;
    const include = process.env.REGISTRY_INCLUDE ? new Set(process.env.REGISTRY_INCLUDE.split(',').map(s=>s.trim())) : null;
    const timeoutMs = process.env.REGISTRY_TIMEOUT_MS ? Number(process.env.REGISTRY_TIMEOUT_MS) : 3000;

    const phases = [...new Set(this.registerFns.map(r=>r.phase))].sort((a,b)=>a-b);
    for (const phase of phases) {
      if (phase > maxPhase) { break; }
      const group = this.registerFns.filter(r=>r.phase===phase && (!include || include.has(r.name)));
      const phaseSummary = { phase, registries: [] };
      await Promise.all(group.map(async reg => {
        const start = performance.now();
        let status = 'ok', toolCountBefore = this.tools.size;
        try {
          let timeoutHandle;
          const race = await Promise.race([
            (async () => {
              await reg.fn(this);
              if (process.env.REGISTRY_PERSIST === '1' && process.env.NODE_ENV !== 'test') {
                await this.persistNewTools();
              }
            })(),
            new Promise((_,rej)=>{
              timeoutHandle = setTimeout(()=>rej(new Error('timeout')), timeoutMs);
            })
          ]);
          if (timeoutHandle) clearTimeout(timeoutHandle);
          if (race === undefined) { /* ignore */ }
        } catch (e) {
          status = e.message === 'timeout' ? 'timeout' : 'error';
        }
        phaseSummary.registries.push({ name: reg.name, status, durationMs: Math.round(performance.now()-start) , added: this.tools.size - toolCountBefore });
      }));
      this.metrics.phases.push(phaseSummary);
    }
    this.initialized = true;
    return true;
  }
  registerTool(def) {
    // Wrap in DynamicTool for compatibility with downstream LangChain usage
    const wrapped = new DynamicTool({
      name: def.name,
      description: def.description,
      schema: def.schema,
      func: async input => {
        try {
          const res = await def.func(input||{});
          return typeof res === 'string' ? res : JSON.stringify(res, null, 2);
        } catch (e) {
          return JSON.stringify({ success:false, error: e.message, tool: def.name }, null, 2);
        }
      }
    });
    wrapped.category = def.category;
    wrapped.registered_at = new Date().toISOString();
    this.tools.set(def.name, wrapped);
    if (def.schema) this.rawSchemas.set(def.name, def.schema);
  }
  async persistNewTools() {
    if (!db || !db.query) return;
    // Basic upsert per tool
    for (const [name, def] of this.tools) {
      try {
        await db.query(`INSERT INTO tool_definitions(name, category, version, description, schema_json)
          VALUES ($1,$2,$3,$4,$5)
          ON CONFLICT (name) DO UPDATE SET category=EXCLUDED.category, version=EXCLUDED.version, description=EXCLUDED.description, schema_json=EXCLUDED.schema_json, updated_at=now()`,
          [name, def.category || null, 1, def.description || null, JSON.stringify(def.schema?._def ? def.schema._def : def.schema || {})]);
        if (process.env.REGISTRY_EMBED === '1') {
          const emb = await this.embeddingService.generateEmbedding({
            name,
            description: def.description,
            category: def.category,
            schema: def.schema
          });
            if (emb) await this.embeddingService.upsertEmbedding(name, emb);
        }
      } catch (e) {
        console.warn('[CompositeRegistry] persistence error for tool', name, e.message);
      }
    }
  }
  getTool(name){ return this.tools.get(name); }
  listTools(){ return [...this.tools.keys()]; }
}
export default CompositeRegistry;
