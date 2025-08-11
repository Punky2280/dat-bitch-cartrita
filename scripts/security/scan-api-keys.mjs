#!/usr/bin/env node
/*
 * scan-api-keys.mjs
 * Safe API key discovery (redacted) producing JSON inventory.
 * Heuristics only; does NOT print raw secrets. Designed for local security audits.
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const ROOT = process.cwd();
const INCLUDE_EXT = new Set(['.js','.mjs','.cjs','.ts','.tsx','.sh','.env','.yml','.yaml','.json','.md']);
const MAX_FILE_BYTES = 200_000; // skip large binaries

// Common key/token regex fragments
const PATTERNS = [
  { name: 'openai', regex: /sk-[A-Za-z0-9]{20,}/g },
  { name: 'github', regex: /ghp_[A-Za-z0-9]{20,}/g },
  { name: 'gitlab', regex: /glpat-[A-Za-z0-9_-]{20,}/g },
  { name: 'hf_hub', regex: /hf_[A-Za-z0-9]{20,}/g },
  { name: 'google_api', regex: /AIza[0-9A-Za-z_-]{20,}/g },
  { name: 'bearer_generic', regex: /(?<=bearer\s)[A-Za-z0-9-_]{20,}/gi },
  { name: 'aws_access_key', regex: /AKIA[0-9A-Z]{16}/g },
  { name: 'jwt_like', regex: /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g }
];

const ENV_ASSIGN = /(OPENAI|DEEPGRAM|GITHUB|GITLAB|TAVILY|SERPAPI|GNEWS|WOLFRAM|LANGCHAIN|GOOGLE|ENCRYPTION)_([A-Z0-9_]+)\s*=\s*([^\n]+)/;

const ignoreDirs = new Set(['node_modules','.git','dist','build','coverage','docs/output']);

const findings = [];

function hashValue(v){
  return crypto.createHash('sha256').update(v).digest('hex');
}

function redact(v){
  if (v.length <= 8) return '*'.repeat(v.length);
  return v.slice(0,4) + '...' + v.slice(-4);
}

function scanFile(file){
  try {
    const stat = fs.statSync(file);
    if (!stat.isFile()) return;
    if (stat.size > MAX_FILE_BYTES) return;
    const ext = path.extname(file).toLowerCase();
    if (!INCLUDE_EXT.has(ext)) return;
    const content = fs.readFileSync(file,'utf8');

    // Direct pattern matches
    for (const pat of PATTERNS){
      const matches = content.match(pat.regex);
      if (matches){
        matches.forEach(raw => {
          findings.push({
            file: path.relative(ROOT,file),
            detector: pat.name,
            sample: redact(raw),
            hash: hashValue(raw),
            length: raw.length,
            line: approximateLine(content, raw)
          });
        });
      }
    }

    // ENV style assignments (only names & hashed values)
    const lines = content.split(/\n/);
    lines.forEach((l,i)=>{
      const m = l.match(ENV_ASSIGN);
      if(m){
        const full = m[0];
        const keyName = full.split('=')[0].trim();
        const val = full.split('=')[1]?.trim() || '';
        if (val && !val.toLowerCase().includes('your_') && val.length>8){
          findings.push({
            file: path.relative(ROOT,file),
            detector: 'env_assign',
            key: keyName,
            sample: redact(val),
            hash: hashValue(val),
            length: val.length,
            line: i+1
          });
        }
      }
    });
  } catch (e) {
    // ignore
  }
}

function approximateLine(content, snippet){
  const idx = content.indexOf(snippet);
  if (idx === -1) return null;
  return content.slice(0, idx).split(/\n/).length;
}

function walk(dir){
  const entries = fs.readdirSync(dir);
  for (const entry of entries){
    if (ignoreDirs.has(entry)) continue;
    const full = path.join(dir, entry);
    let stat;
    try { stat = fs.statSync(full);} catch { continue; }
    if (stat.isDirectory()) walk(full); else scanFile(full);
  }
}

walk(ROOT);

// Consolidate by hash (avoid duplicates output)
const consolidated = Object.values(findings.reduce((acc,f)=>{
  if(!acc[f.hash]) acc[f.hash] = {hash:f.hash, detectors:new Set(), samples:new Set(), occurrences:[]};
  acc[f.hash].detectors.add(f.detector);
  acc[f.hash].samples.add(f.sample);
  acc[f.hash].occurrences.push({file:f.file,line:f.line,key:f.key});
  return acc;
}, {})).map(e=>({
  hash: e.hash,
  detectors: [...e.detectors],
  samples: [...e.samples],
  count: e.occurrences.length,
  occurrences: e.occurrences.slice(0,10) // cap detail
}));

const report = {
  generated_at: new Date().toISOString(),
  root: ROOT,
  total_findings: findings.length,
  unique_values: consolidated.length,
  guidance: 'No raw secrets printed. Use hashes to correlate & rotate. Verify false positives manually.',
  items: consolidated
};

console.log(JSON.stringify(report,null,2));
