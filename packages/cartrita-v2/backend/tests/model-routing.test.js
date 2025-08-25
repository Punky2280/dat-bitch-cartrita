import { describe, it, expect, vi, beforeEach } from 'vitest';

// Dynamically import service (supports ts or js)
async function loadService() {
  try {
    const mod = await import('../src/modelRouting/HuggingFaceRouterService.ts');
    return mod.default || mod.HuggingFaceRouterService || mod;
  } catch (e) {
    const mod = await import('../src/modelRouting/HuggingFaceRouterService.js');
    return mod.default || mod.HuggingFaceRouterService || mod;
  }
}

// Mock axios before service import
vi.mock('axios', () => {
  const instance = {
    post: vi.fn(async (url, body) => {
      if (url.includes('/embeddings')) {
        return { data: { data: [{ embedding: [0.1, 0.2, 0.3] }] } };
      }
      if (body && body.inputs && typeof body.inputs === 'string') {
        return {
          data: [
            { generated_text: 'Mock output for: ' + body.inputs.slice(0, 20) },
          ],
        };
      }
      return { data: [{ label: 'LABEL', score: 0.9 }] };
    }),
    head: vi.fn(async () => ({ status: 200 })),
    defaults: { headers: { common: {} } },
  };
  return {
    default: Object.assign(instance, { create: () => instance }),
  };
});

describe('HuggingFaceRouterService core logic', () => {
  let serviceInstance;
  beforeEach(async () => {
    const ServiceOrInstance = await loadService();
    // If it's a class, instantiate; otherwise assume instance
    if (typeof ServiceOrInstance === 'function')
      serviceInstance = new ServiceOrInstance();
    else serviceInstance = ServiceOrInstance;
  });

  it('classifies summarization / long context prompt', () => {
    const task = serviceInstance.classify?.(
      'Summarize the following article about AI trends.'
    );
    expect(task).toBeTypeOf('string');
    expect([
      'long_context',
      'general',
      'multilingual',
      'embedding',
      'rerank',
    ]).toContain(task);
  });

  it('shortlist returns scored models ordered by compositeScore desc', () => {
    const shortlist = serviceInstance.shortlist?.(
      'Explain how attention works in transformers',
      'text-generation',
      5
    );
    expect(Array.isArray(shortlist)).toBe(true);
    expect(shortlist.length).toBeGreaterThan(0);
    let ordered = true;
    for (let i = 1; i < shortlist.length; i++) {
      if (
        (shortlist[i - 1].compositeScore || 0) <
        (shortlist[i].compositeScore || 0)
      )
        ordered = false;
    }
    expect(ordered).toBe(true);
  });

  it('route produces output and confidence', async () => {
    const result = await serviceInstance.route(
      'List three uses of embeddings in NLP.'
    );
    expect(result).toHaveProperty('model_id');
    expect(result).toHaveProperty('output');
    expect(result).toHaveProperty('confidence');
  });
});
