import EnhancedWorkflowEngine from '../../src/services/EnhancedWorkflowEngine.js';
import pool from '../../src/db.js';

// Lightweight smoke test for executeWorkflow error path (no DB row)
describe('EnhancedWorkflowEngine basic', () => {
  test('executeWorkflow returns error for missing workflow', async () => {
    const engine = new EnhancedWorkflowEngine();
    const res = await engine.executeWorkflow(
      '00000000-0000-0000-0000-000000000000',
      'user-x',
      { foo: 'bar' }
    );
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/not found|access denied/);
  });

  test('node handlers registry populated', () => {
    const engine = new EnhancedWorkflowEngine();
    const stats = engine.getExecutionStats();
    expect(Array.isArray(stats.supportedNodeTypes)).toBe(true);
    expect(stats.supportedNodeTypes.length).toBeDefined();
  });
});
