process.env.USE_COMPOSITE_REGISTRY = '1';
process.env.REGISTRY_PHASE_MAX = '0';
process.env.MINIMAL_REGISTRY = '1';

import { describe, test, beforeAll, expect } from 'vitest';
import CompositeRegistry from '../../src/agi/orchestration/CompositeRegistry.js';
import registerSystemTools from '../../src/agi/orchestration/registries/systemRegistry.js';
console.log('[toolSchema.test] loaded');

describe('Tool Schema Regression', () => {
  let registry;
  beforeAll(async () => {
    registry = new CompositeRegistry();
    registry.addMiniRegistry('system', 0, registerSystemTools);
    await registry.initialize();
  });

  test('getCurrentDateTime schema supplies default ISO format', async () => {
    const schema = registry.rawSchemas.get('getCurrentDateTime');
    expect(schema).toBeDefined();
    const parsed = await schema.parseAsync({});
    expect(parsed).toEqual({ format: 'ISO' });
  });
});
