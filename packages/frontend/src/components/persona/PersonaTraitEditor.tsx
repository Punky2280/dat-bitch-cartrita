import React, { useEffect, useState } from 'react';
import { colors } from '@/theme/tokens';

export interface PersonaConfig {
  tone: number; creativity: number; empathy: number; analytical_depth: number; brevity: number; humor: number; proactivity: number;
  domain_focus: string[]; style_notes: string; interaction_modes: { empathetic:boolean; witty:boolean; direct:boolean; analytical:boolean; };
}
interface DerivedParams { temperature:number; top_p:number; max_output_tokens:number; reasoning_depth:number; humor_probability:number; suggestion_interval:number; style:any; }

const defaultPersona: PersonaConfig = {
  tone:5, creativity:5, empathy:5, analytical_depth:5, brevity:5, humor:4, proactivity:5,
  domain_focus:[], style_notes:'', interaction_modes:{ empathetic:true, witty:true, direct:false, analytical:false }
};

// Slider trait keys limited to numeric properties
const sliderTraits: { key: keyof PersonaConfig; label: string; min:number; max:number; step:number }[] = [
  { key:'tone', label:'Tone', min:0, max:10, step:0.05 },
  { key:'creativity', label:'Creativity', min:0, max:10, step:0.05 },
  { key:'empathy', label:'Empathy', min:0, max:10, step:0.05 },
  { key:'analytical_depth', label:'Analytical Depth', min:0, max:10, step:0.05 },
  { key:'brevity', label:'Brevity', min:0, max:10, step:0.05 },
  { key:'humor', label:'Humor', min:0, max:10, step:0.05 },
  { key:'proactivity', label:'Proactivity', min:0, max:10, step:0.05 },
];

export const PersonaTraitEditor: React.FC = () => {
  const [persona, setPersona] = useState<PersonaConfig>(defaultPersona);
  const [derived, setDerived] = useState<DerivedParams | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [domainInput, setDomainInput] = useState('');

  const fetchPersona = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/persona', { credentials:'include' });
      const data = await res.json();
  if (data.success) { setPersona(prev => ({ ...prev, ...data.persona })); setDerived(data.derived); }
      else setError(data.error || 'Failed to load persona');
    } catch (e:any) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchPersona(); }, []);

  const updateServer = async (next: PersonaConfig) => {
    setLoading(true); setError(null);
    try {
      const res = await fetch('/api/persona', { method:'PUT', headers:{ 'Content-Type':'application/json' }, credentials:'include', body: JSON.stringify(next) });
      const data = await res.json();
      if (data.success) { setPersona(data.persona); setDerived(data.derived); }
      else setError(data.error || 'Update failed');
    } catch (e:any) { setError(e.message); }
    finally { setLoading(false); }
  };

  const onSlider = (k: keyof PersonaConfig, v: number) => {
    const next = { ...persona, [k]: v } as PersonaConfig; setPersona(next); updateServer(next);
  };

  const toggleInteractionMode = (mode: keyof PersonaConfig['interaction_modes']) => {
    const current = persona.interaction_modes;
    const nextModes = { ...current, [mode]: !current[mode] };
    // Enforce at least one true client-side (backend also enforces)
    if (!Object.values(nextModes).some(Boolean)) {
      // Revert this toggle (ignore attempt to turn off last true)
      return;
    }
    const next = { ...persona, interaction_modes: nextModes } as PersonaConfig;
    setPersona(next);
    updateServer(next);
  };

  const addDomain = () => {
    const trimmed = domainInput.trim(); if (!trimmed) return; const next = { ...persona, domain_focus: [...persona.domain_focus, trimmed].slice(0,5) } as PersonaConfig; setDomainInput(''); updateServer(next);
  };

  const removeDomain = (d:string) => {
    const next = { ...persona, domain_focus: persona.domain_focus.filter(x=>x!==d) } as PersonaConfig; updateServer(next);
  };

  return (<div style={{ padding:'1rem', border:`1px solid ${colors.gray500}`, borderRadius:8 }}>
    <h2>Persona Traits</h2>
    {loading && <div>Loading...</div>}
    {error && <div style={{ color:'red' }}>{error}</div>}
    <div style={{ display:'grid', gap:'0.75rem' }}>
      {sliderTraits.map(t => {
        const val = persona[t.key] as unknown as number; // numeric by design
        return (
          <label key={t.key} style={{ display:'flex', flexDirection:'column' }}>
            <span>{t.label}: {val}</span>
            <input type="range" min={t.min} max={t.max} step={t.step} value={val} onChange={e=>onSlider(t.key, Number(e.target.value))} />
          </label>
        );
      })}
    </div>
    <div style={{ marginTop:'1rem' }}>
      <h3>Interaction Modes</h3>
      <div style={{ display:'flex', gap:'1rem', flexWrap:'wrap' }}>
        {Object.entries(persona.interaction_modes).map(([k, v]) => (
          <label key={k} style={{ display:'flex', alignItems:'center', gap:4 }}>
            <input type="checkbox" checked={v} onChange={()=>toggleInteractionMode(k as keyof PersonaConfig['interaction_modes'])} />
            <span style={{ textTransform:'capitalize' }}>{k.replace('_',' ')}</span>
          </label>
        ))}
      </div>
      <small style={{ display:'block', marginTop:4, opacity:0.7 }}>At least one mode must remain enabled.</small>
    </div>
    <div style={{ marginTop:'1rem' }}>
      <h3>Domain Focus</h3>
      <div style={{ display:'flex', gap:'0.5rem' }}>
        <input value={domainInput} onChange={e=>setDomainInput(e.target.value)} placeholder="Add domain (e.g. finance)" />
        <button type="button" onClick={addDomain}>Add</button>
      </div>
      <div style={{ marginTop:'0.5rem', display:'flex', gap:'0.5rem', flexWrap:'wrap' }}>
  {persona.domain_focus.map(d => <span key={d} style={{ background:colors.gray600, padding:'0.25rem 0.5rem', borderRadius:4 }}>
          {d} <button style={{ marginLeft:4 }} onClick={()=>removeDomain(d)}>x</button>
        </span>)}
      </div>
    </div>
    <div style={{ marginTop:'1rem' }}>
      <h3>Style Notes</h3>
      <textarea value={persona.style_notes} onChange={e=>{ const next = { ...persona, style_notes:e.target.value.slice(0,400) } as PersonaConfig; setPersona(next); }} onBlur={()=>updateServer(persona)} rows={3} style={{ width:'100%' }} />
    </div>
    {derived && <div style={{ marginTop:'1rem' }}>
      <h3>Derived Generation Parameters</h3>
  <pre style={{ background:colors.gray900, padding:'0.75rem', maxHeight:200, overflow:'auto' }}>{JSON.stringify(derived, null, 2)}</pre>
    </div>}
  </div>);
};

export default PersonaTraitEditor;
