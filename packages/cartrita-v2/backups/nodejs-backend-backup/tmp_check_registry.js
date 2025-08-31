process.env.USE_COMPOSITE_REGISTRY='1';
process.env.REGISTRY_PHASE_MAX=process.argv[2]||'1';
import('./src/agi/orchestration/AgentToolRegistry.js').then(({default:Reg})=>{
  const r=new Reg();
  r.initialize().then(()=>{
    console.log('Loaded tools count:', r.tools.size);
    console.log('Tool names:', [...r.tools.keys()]);
  }).catch(e=>{console.error('Init error', e);});
});
