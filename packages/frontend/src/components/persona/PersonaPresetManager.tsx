import React, { useEffect, useState } from 'react';
import { colors, semantic } from '@/theme/tokens';
import type { PersonaConfig } from './PersonaTraitEditor';

interface Preset { id:number; name:string; persona_config: PersonaConfig; created_at:string; }

export const PersonaPresetManager: React.FC = () => {
  const [presets, setPresets] = useState<Preset[]>([]);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/persona/presets', { credentials:'include' });
      const data = await res.json();
      if (data.success) setPresets(data.presets); else setError(data.error || 'Failed to load presets');
    } catch (e:any) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!name.trim()) return; setLoading(true);
    try {
      const res = await fetch('/api/persona/presets', { method:'POST', headers:{'Content-Type':'application/json'}, credentials:'include', body: JSON.stringify({ name, persona_config:{} }) });
      const data = await res.json();
      if (data.success) { setName(''); load(); } else setError(data.error || 'Create failed');
    } catch (e:any) { setError(e.message); setLoading(false); }
  };

  const remove = async (id:number) => {
    setLoading(true);
    try {
      await fetch(`/api/persona/presets/${id}`, { method:'DELETE', credentials:'include' });
      load();
    } catch (e:any) { setError(e.message); setLoading(false); }
  };

  return <div style={{ padding:'1rem', border:`1px solid ${semantic.border}`, borderRadius:8, background: semantic.surface }}>
    <h2>Persona Presets</h2>
    {loading && <div>Loading...</div>}
  {error && <div style={{ color: semantic.critical }}>{error}</div>}
    <div style={{ display:'flex', gap:'0.5rem', marginBottom:'0.75rem' }}>
      <input value={name} onChange={e=>setName(e.target.value)} placeholder="Preset name" />
      <button onClick={create} disabled={!name.trim()}>Save Current</button>
    </div>
    <ul style={{ listStyle:'none', padding:0, margin:0, display:'grid', gap:'0.5rem' }}>
  {presets.map(p => <li key={p.id} style={{ background: colors.gray800, padding:'0.5rem 0.75rem', borderRadius:6, display:'flex', justifyContent:'space-between', alignItems:'center', border:`1px solid ${semantic.borderSubtle}` }}>
        <span>{p.name}</span>
        <button onClick={()=>remove(p.id)}>Delete</button>
      </li>)}
    </ul>
  </div>;
};

export default PersonaPresetManager;
