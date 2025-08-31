import express from 'express';

// Assumes global.coreAgent set during startup and HF orchestrator optional
const router = express.Router();

router.get('/role-call', async (req, res) => {
  const wait = parseInt(req.query.wait || '0', 10);
  const deadline = Date.now() + Math.min(wait, 3000);
  // Optionally wait briefly for supervisor initialization if requested
  while (
    wait > 0 &&
    Date.now() < deadline &&
    !global.coreAgent?.isInitialized
  ) {
    await new Promise(r => setTimeout(r, 50));
  }
  const names = global.coreAgent?.subAgents
    ? Array.from(global.coreAgent.subAgents.keys())
    : [];
  try {
    if (global.hfOrchestrator?.agents) {
      for (const name of global.hfOrchestrator.agents.keys()) {
        if (!names.includes(name)) names.push(name);
      }
    }
  } catch (_) {}
  const readiness = {
    supervisor_initialized: !!global.coreAgent?.isInitialized,
    hf_orchestrator_initialized: !!global.hfOrchestrator?.agents,
    registered_count: names.length,
  };
  res.json({ success: true, agents: names, readiness });
});

router.get('/capabilities', async (req, res) => {
  const result = { supervisor: {}, huggingface: {} };
  try {
    if (global.coreAgent?.subAgents) {
      for (const [name, agent] of global.coreAgent.subAgents.entries()) {
        result.supervisor[name] = {
          description: agent.config?.description || agent.personality || 'N/A',
          allowedTools: agent.config?.allowedTools || [],
        };
      }
    }
    if (global.hfOrchestrator?.getAgentCapabilities) {
      result.huggingface = await global.hfOrchestrator.getAgentCapabilities();
    }
    res.json({ success: true, data: result });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

export default router;
