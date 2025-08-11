#!/usr/bin/env node
// Simple smoke test for EnhancedKnowledgeHub + RedisService graceful init flags
import KnowledgeHub from '../src/services/EnhancedKnowledgeHub.js';
import RedisService from '../src/services/RedisService.js';

async function runCase(name, env) {
  const prev = {};
  for (const k of Object.keys(env)) prev[k] = process.env[k];
  Object.assign(process.env, env);
  const kh = KnowledgeHub; // singleton style
  const redis = RedisService;
  await kh.initialize();
  await redis.initialize();
  const status = {
    case: name,
    kh: { disabled: kh.disabled, initAttempted: kh.initAttempted },
    redis: { disabled: redis.disabled, connected: redis.connected },
  };
  // restore
  for (const k of Object.keys(env)) {
    if (prev[k] === undefined) delete process.env[k]; else process.env[k] = prev[k];
  }
  return status;
}

async function main() {
  const results = [];
  results.push(await runCase('lightweight_test', { LIGHTWEIGHT_TEST: '1' }));
  results.push(await runCase('disable_all', { DISABLE_REDIS: '1', DISABLE_KNOWLEDGE_HUB: '1' }));
  results.push(await runCase('optional_missing', { KNOWLEDGE_HUB_OPTIONAL: '1' }));
  console.log(JSON.stringify(results, null, 2));
}

main().catch(e => {
  console.error('Smoke test failed', e);
  process.exit(1);
});
