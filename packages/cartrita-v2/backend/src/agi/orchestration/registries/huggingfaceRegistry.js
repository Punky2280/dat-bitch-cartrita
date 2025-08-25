// huggingfaceRegistry: phase 3 HF tool registration (skeleton).
import { z } from 'zod';

export async function registerHuggingFaceTools(registry) {
  // Placeholder simple tool if full orchestrator not loaded.
  if (!process.env.HF_TOKEN) {
    registry.registerTool({
      name: 'hf_status',
      description: 'Report HuggingFace integration status',
      category: 'huggingface',
      schema: z.object({}),
      func: async () => ({ integrated: false, reason: 'HF_TOKEN not set' }),
    });
    return;
  }
  try {
    const { default: AgentOrchestrator } = await import(
      '../../integrations/huggingface/AgentOrchestrator.js'
    );
    const orchestrator = new AgentOrchestrator();
    await orchestrator.initialize();
    registry.registerTool({
      name: 'hf_text_classification',
      description: 'Classify text with HF route',
      category: 'huggingface',
      schema: z.object({ text: z.string() }),
      func: async ({ text }) =>
        orchestrator.classifyText?.(text) || { error: 'not implemented' },
    });
  } catch (e) {
    registry.registerTool({
      name: 'hf_status',
      description: 'HF init error',
      category: 'huggingface',
      schema: z.object({}),
      func: async () => ({ integrated: false, error: e.message }),
    });
  }
}
export default registerHuggingFaceTools;
