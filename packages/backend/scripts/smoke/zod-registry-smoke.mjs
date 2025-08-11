#!/usr/bin/env node
/**
 * Zod Registry Smoke Test
 * Initializes major registries to validate schemas after Zod upgrade.
 * Run with: NODE_ENV=test DB_SKIP=1 node packages/backend/scripts/smoke/zod-registry-smoke.mjs
 */
import AgentToolRegistry from '../../src/agi/orchestration/AgentToolRegistry.js';
import EnhancedLangChainToolRegistry from '../../src/agi/orchestration/EnhancedLangChainToolRegistry.js';
import fullyFunctionalToolRegistry from '../../src/agi/orchestration/FullyFunctionalToolRegistry.js';
import SupervisorRegistry from '../../src/system/SupervisorRegistry.js';

async function main() {
  const summary = { start: new Date().toISOString() };
  const errors = [];

  try {
    const atr = new AgentToolRegistry();
    await atr.initialize();
    summary.agentToolRegistry = { tools: atr.tools.size };
  } catch (e) {
    errors.push({ registry: 'AgentToolRegistry', error: e.message });
  }

  try {
    const eltr = new EnhancedLangChainToolRegistry();
    await eltr.initialize();
    summary.enhancedLangChainToolRegistry = { tools: eltr.tools.size };
  } catch (e) {
    errors.push({ registry: 'EnhancedLangChainToolRegistry', error: e.message });
  }

  try {
    await fullyFunctionalToolRegistry.initialize();
    summary.fullyFunctionalToolRegistry = { tools: fullyFunctionalToolRegistry.tools.size };
  } catch (e) {
    errors.push({ registry: 'FullyFunctionalToolRegistry', error: e.message });
  }

  try {
    // SupervisorRegistry is singleton already instantiated; just probe status
    summary.supervisorRegistry = SupervisorRegistry.getHierarchyStatus();
  } catch (e) {
    errors.push({ registry: 'SupervisorRegistry', error: e.message });
  }

  summary.end = new Date().toISOString();
  summary.errors = errors;
  const success = errors.length === 0;
  console.log(JSON.stringify({ success, summary }, null, 2));
  process.exit(success ? 0 : 1);
}

main();
