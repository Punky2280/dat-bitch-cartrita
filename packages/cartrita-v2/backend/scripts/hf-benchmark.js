#!/usr/bin/env node
/*
 * Hugging Face Routing Benchmark Harness
 * Measures latency, confidence, fallbacks across sample prompts & tasks.
 */

import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Dynamic import to avoid early initialization side-effects
async function loadRouter() {
  const mod = await import('../src/modelRouting/HuggingFaceRouterService.ts');
  return mod.default || mod.router || mod; // support different export patterns
}

const prompts = [
  {
    task: 'text-generation',
    prompt: 'Explain retrieval augmented generation simply.',
  },
  {
    task: 'text-generation',
    prompt: 'List 5 security hardening measures for a Node.js API.',
  },
  {
    task: 'translation',
    prompt:
      'Translate to French: The model router selected an efficient encoder.',
  },
  {
    task: 'embedding',
    prompt: 'Neural search vector representation importance.',
  },
  {
    task: 'rerank',
    prompt: 'Graph databases benefits for recommendation systems.',
  },
];

const results = [];

function hrtimeMs(start) {
  const diff = process.hrtime(start);
  return diff[0] * 1000 + diff[1] / 1e6;
}

async function run() {
  const router = await loadRouter();
  for (const item of prompts) {
    const start = process.hrtime();
    let outcome;
    try {
      outcome = await router.route(item.prompt, { taskHint: item.task });
    } catch (e) {
      outcome = { error: e.message };
    }
    const elapsed = hrtimeMs(start).toFixed(1);
    results.push({
      task: item.task,
      prompt_tokens: item.prompt.split(/\s+/).length,
      model: outcome?.model_id || 'N/A',
      confidence: outcome?.confidence ?? null,
      latency_ms: Number(elapsed),
      fallback_chain: outcome?.attempts?.length || 0,
      success: !!outcome && !outcome.error,
      error: outcome?.error || null,
    });
    process.stdout.write(
      `• ${item.task} -> ${results[results.length - 1].model} (${elapsed} ms)\n`
    );
  }

  // Output JSON & CSV side by side
  const outDir = path.join(__dirname, '..', 'benchmark-output');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const jsonPath = path.join(outDir, `hf-benchmark-${timestamp}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(results, null, 2));

  const headers = Object.keys(results[0]);
  const csv = [headers.join(',')]
    .concat(
      results.map(r =>
        headers
          .map(h =>
            r[h] !== null && r[h] !== undefined
              ? String(r[h]).replace(/,/g, ';')
              : ''
          )
          .join(',')
      )
    )
    .join('\n');
  const csvPath = path.join(outDir, `hf-benchmark-${timestamp}.csv`);
  fs.writeFileSync(csvPath, csv);

  console.log(`\nSaved JSON: ${jsonPath}`);
  console.log(`Saved CSV: ${csvPath}`);
}

run().catch(err => {
  console.error('Benchmark failed:', err);
  process.exit(1);
});
