import AgentToolRegistry from '../../src/agi/orchestration/AgentToolRegistry.js';

// Use minimal system-only mode
process.env.MINIMAL_REGISTRY = '1';
process.env.NODE_ENV = 'test';

describe('AgentToolRegistry minimal init', () => {
  test('initializes system tools only', async () => {
    const reg = new AgentToolRegistry();
    const ok = await reg.initialize();
    expect(ok).toBe(true);
    // Expect at least core system tools
    const hasDate = reg.tools.has('getCurrentDateTime');
    const hasStatus = reg.tools.has('getSystemStatus');
    expect(hasDate).toBe(true);
    expect(hasStatus).toBe(true);
  });
});
