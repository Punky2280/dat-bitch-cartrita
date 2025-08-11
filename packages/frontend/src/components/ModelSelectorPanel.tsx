import React, { useEffect, useState, useMemo } from 'react';
import { Card } from './ui/card';
import { Button } from './ui/button';

interface ModelCatalogEntry {
  idx: number;
  repo_id: string;
  category: string;
  approx_params: string;
  primary_tasks: string[];
  serverless_candidate: boolean;
  requires_endpoint: boolean;
  notes: string;
}

interface RouteResult {
  model_id: string;
  output: string;
  task: string;
  confidence: number;
  timing_ms: number;
  used_fallbacks: number;
}

const CATEGORY_ORDER = [
  'general','code','math','multilingual','long_context','tool_use','vision_language','audio','embedding','rerank','safety','lightweight','compression','meta'
];

export const ModelSelectorPanel: React.FC = () => {
  // Allow overriding API host (falls back to same-origin + Vite proxy)
  const API_BASE = (import.meta as any).env?.VITE_API_BASE || '';
  const [catalog, setCatalog] = useState<ModelCatalogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string|null>(null);
  const [category, setCategory] = useState<string>('all');
  const [query, setQuery] = useState('');
  const [prompt, setPrompt] = useState('Explain the benefits of streaming architectures.');
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeResult, setRouteResult] = useState<RouteResult| null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
  fetch(`${API_BASE}/api/models/catalog`)
      .then(r => r.json())
      .then(j => { if (!active) return; if (j.success) setCatalog(j.data); else setError(j.error||'Failed to load catalog'); })
      .catch(e => { if (active) setError(e.message); })
      .finally(()=>active && setLoading(false));
    return () => { active = false; };
  }, []);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return catalog.filter(m => (category==='all'||m.category===category) && (!q || m.repo_id.toLowerCase().includes(q) || m.primary_tasks.some(t=>t.toLowerCase().includes(q))));
  }, [catalog, category, query]);

  const grouped = useMemo(() => {
    const map: Record<string, ModelCatalogEntry[]> = {};
    filtered.forEach(m => { if (!map[m.category]) map[m.category] = []; map[m.category].push(m); });
    for (const k of Object.keys(map)) map[k].sort((a,b)=>a.repo_id.localeCompare(b.repo_id));
    return map;
  }, [filtered]);

  const doRoute = async () => {
    setRouteLoading(true); setError(null); setRouteResult(null);
    try {
  const res = await fetch(`${API_BASE}/api/models/route`,{ method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ prompt }) });
      const j = await res.json();
      if (!j.success) throw new Error(j.error||'Route failed');
      setRouteResult(j.result);
    } catch(e:any) { setError(e.message); }
    finally { setRouteLoading(false); }
  };

  return (
    <Card className="p-4 space-y-4 max-w-4xl mx-auto">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h2 className="text-lg font-semibold">Model Router</h2>
        <div className="flex gap-2 flex-wrap items-center">
          <select value={category} onChange={e=>setCategory(e.target.value)} className="border px-2 py-1 rounded text-sm">
            <option value="all">All Categories</option>
            {CATEGORY_ORDER.filter(c=>catalog.some(m=>m.category===c)).map(c=> <option key={c} value={c}>{c}</option>)}
          </select>
          <input placeholder="Search models/tasks" value={query} onChange={e=>setQuery(e.target.value)} className="border px-2 py-1 rounded text-sm" />
        </div>
      </div>
      {loading && <div className="text-sm text-muted-foreground">Loading catalog…</div>}
      {error && <div className="text-sm text-red-600">{error}</div>}
      {!loading && !error && (
        <div className="max-h-72 overflow-auto border rounded">
          {CATEGORY_ORDER.filter(c=>grouped[c]).map(cat => (
            <div key={cat} className="border-b last:border-b-0">
              <div className="bg-muted/50 px-2 py-1 text-xs font-medium uppercase tracking-wide flex justify-between">
                <span>{cat}</span><span>{grouped[cat].length}</span>
              </div>
              <ul className="divide-y">
                {grouped[cat].map(m => (
                  <li key={m.repo_id} className="px-2 py-1 text-xs flex flex-col gap-0.5">
                    <div className="flex justify-between">
                      <span className="font-mono">{m.repo_id}</span>
                      <span className="text-[10px] text-muted-foreground">{m.approx_params}</span>
                    </div>
                    <div className="text-[10px] text-muted-foreground truncate">{m.primary_tasks.join(', ')}</div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {filtered.length === 0 && <div className="p-3 text-xs text-muted-foreground">No models match filters.</div>}
        </div>
      )}
      <div className="space-y-2">
        <textarea value={prompt} onChange={e=>setPrompt(e.target.value)} className="w-full border rounded p-2 text-sm h-28" />
        <div className="flex gap-2 items-center">
          <Button disabled={routeLoading} onClick={doRoute}>{routeLoading? 'Routing…':'Route Prompt'}</Button>
          {routeResult && <span className="text-xs text-muted-foreground">{routeResult.model_id} • {routeResult.task} • {routeResult.timing_ms}ms • conf {(routeResult.confidence*100).toFixed(0)}%</span>}
        </div>
        {routeResult && (
          <div className="border rounded p-2 bg-muted/30 text-sm whitespace-pre-wrap max-h-64 overflow-auto">
            {typeof routeResult.output === 'string' ? routeResult.output : JSON.stringify(routeResult.output, null, 2)}
          </div>
        )}
      </div>
    </Card>
  );
};

export default ModelSelectorPanel;
