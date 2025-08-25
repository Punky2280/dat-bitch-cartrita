#!/usr/bin/env node
/*
 * Hugging Face Model Routing CLI
 * Usage examples:
 *   node scripts/hf-route-cli.js --prompt "Explain transformers" --task text-generation
 *   node scripts/hf-route-cli.js -p prompt.txt --json
 *   HF_ROUTE_MODE=http node scripts/hf-route-cli.js -P "List 3 facts" --server http://localhost:8001 --jwt $TEST_JWT
 *
 * Strategy:
 *  - Default: direct in-process service (avoids network, for local dev) requiring relative import.
 *  - HTTP mode: set HF_ROUTE_MODE=http (or pass --http) to call running backend API.
 *  - Outputs minimal fields by default; --verbose for debug scoring details; --json for raw JSON.
 */
import fs from 'fs';
import path from 'path';
import url from 'url';
import process from 'process';
import axios from 'axios';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-p' || a === '--prompt') args.prompt = argv[++i];
    else if (a === '-P' || a === '--prompt-text') args.promptText = argv[++i];
    else if (a === '-t' || a === '--task') args.task = argv[++i];
    else if (a === '--max') args.max = Number(argv[++i]);
    else if (a === '--temperature' || a === '-T')
      args.temperature = Number(argv[++i]);
    else if (a === '--json') args.json = true;
    else if (a === '--verbose' || a === '-v') args.verbose = true;
    else if (a === '--http') args.http = true;
    else if (a === '--server') args.server = argv[++i];
    else if (a === '--jwt') args.jwt = argv[++i];
    else if (a === '--help' || a === '-h') args.help = true;
    else if (!args.promptText && !a.startsWith('-')) args.promptText = a; // positional
  }
  return args;
}

function help() {
  console.log(
    `HF Route CLI\n\nOptions:\n  -p, --prompt <file>        File containing prompt text\n  -P, --prompt-text <text>   Prompt text inline (positional also works)\n  -t, --task <task>          Optional task hint (text-generation, summarization, embedding, rerank, translate)\n  --max <n>                  Max candidate models to probe (default 4)\n  -T, --temperature <num>    Optional generation temperature (forwarded)\n  --json                     Output raw JSON\n  -v, --verbose              Include scoring + shortlist\n  --http                     Force HTTP mode instead of in-process\n  --server <url>             Backend server base (default http://localhost:8001)\n  --jwt <token>              Auth bearer token for protected endpoints\n  -h, --help                 Show this help\n\nEnvironment:\n  HF_TOKEN            Hugging Face token (for direct mode)\n  HF_ROUTE_MODE=http  Force HTTP mode\n`
  );
}

async function run() {
  const args = parseArgs(process.argv);
  if (args.help) {
    help();
    process.exit(0);
  }
  let prompt = args.promptText;
  if (!prompt && args.prompt) {
    const filePath = path.resolve(process.cwd(), args.prompt);
    if (!fs.existsSync(filePath)) {
      console.error('Prompt file not found:', filePath);
      process.exit(1);
    }
    prompt = fs.readFileSync(filePath, 'utf8');
  }
  if (!prompt) {
    console.error('Prompt text required (use -P or -p file).');
    process.exit(1);
  }

  const forceHttp = args.http || process.env.HF_ROUTE_MODE === 'http';
  if (forceHttp) {
    const base = args.server || 'http://localhost:8001';
    try {
      const resp = await axios.post(
        `${base}/api/models/route`,
        {
          prompt,
          taskHint: args.task,
          maxCandidates: args.max,
          temperature: args.temperature,
        },
        {
          headers: args.jwt
            ? { Authorization: `Bearer ${args.jwt}` }
            : undefined,
          timeout: 60_000,
        }
      );
      output(resp.data, args);
    } catch (err) {
      console.error('HTTP routing error:', err.response?.data || err.message);
      process.exit(2);
    }
    return;
  }

  // In-process path: dynamic import service
  try {
    const svcMod = await import(
      '../src/modelRouting/HuggingFaceRouterService.ts'
    ).catch(async () => {
      // Fallback to compiled JS if transpiled
      return import('../src/modelRouting/HuggingFaceRouterService.js');
    });
    const router = svcMod.default || svcMod.HuggingFaceRouterService || svcMod;
    const instance = typeof router === 'function' ? new router() : router;
    const result = await instance.route({
      prompt,
      taskHint: args.task,
      options: { maxCandidates: args.max, temperature: args.temperature },
    });
    output({ success: true, data: result }, args);
  } catch (e) {
    console.error('In-process routing error:', e.message);
    process.exit(3);
  }
}

function output(payload, args) {
  if (args.json) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }
  if (!payload.success) {
    console.error('Error:', payload.error || 'Unknown error');
    process.exit(1);
  }
  const data = payload.data || payload;
  const { chosenModel, task, tokens, confidence, fallbacks, shortlist } = data;
  console.log(`Task: ${task}`);
  console.log(`Chosen Model: ${chosenModel}`);
  if (confidence != null) console.log(`Confidence: ${confidence.toFixed(3)}`);
  if (tokens != null) console.log(`Tokens: ${tokens}`);
  if (Array.isArray(fallbacks) && fallbacks.length)
    console.log(`Fallbacks Used: ${fallbacks.length}`);
  if (args.verbose && Array.isArray(shortlist)) {
    console.log('\nShortlist:');
    shortlist.forEach((m, i) => {
      console.log(
        `  ${i + 1}. ${m.repo_id || m.id || m.model} score=${m.compositeScore?.toFixed?.(3)}`
      );
    });
  }
  if (data.output) {
    console.log('\n--- Output ---');
    console.log(
      typeof data.output === 'string'
        ? data.output.trim()
        : JSON.stringify(data.output, null, 2)
    );
  }
}

run();
