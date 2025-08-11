#!/usr/bin/env node
import '../src/loadEnv.js';
import EnhancedKnowledgeHub from '../src/services/EnhancedKnowledgeHub.js';
import redis from '../src/services/RedisService.js';

async function main() {
  const KH = new EnhancedKnowledgeHub();
  const khInit = KH.initialize();
  const redisInit = redis.initialize();
  const [khReady] = await Promise.all([khInit, redisInit]);
  console.log('[verify] KH status:', KH.getStatus());
  console.log('[verify] Redis connected:', redis.connected, 'disabled:', redis.disabled);
  if (!KH.ready) {
    console.error('[verify] ❌ Knowledge Hub not ready');
    process.exitCode = 1;
  }
  if (!redis.connected) {
    console.error('[verify] ❌ Redis not connected');
    process.exitCode = 1;
  }
}

main().catch(e => { console.error('[verify] Error:', e); process.exit(1); });
