#!/usr/bin/env node
// Minimal micro test harness (isolated from Jest/Vitest issues)
const tests = [];
const beforeAllHooks = [];
const afterAllHooks = [];
function describe(_name, fn) {
  fn();
}
function test(name, fn) {
  tests.push({ name, fn });
}
const it = test;
function beforeAll(fn) {
  beforeAllHooks.push(fn);
}
function afterAll(fn) {
  afterAllHooks.push(fn);
}
function expect(actual) {
  return {
    toBe(expected) {
      if (actual !== expected)
        throw new Error(`Expected ${actual} toBe ${expected}`);
    },
    toEqual(expected) {
      const a = JSON.stringify(actual);
      const b = JSON.stringify(expected);
      if (a !== b) throw new Error(`Expected ${a} toEqual ${b}`);
    },
    toBeDefined() {
      if (actual === undefined) throw new Error('Expected value to be defined');
    },
    toMatch(re) {
      if (!(typeof actual === 'string' && re.test(actual)))
        throw new Error(`Expected ${actual} toMatch ${re}`);
    },
  };
}
global.describe = describe;
global.test = test;
global.it = it;
global.beforeAll = beforeAll;
global.afterAll = afterAll;
global.expect = expect;

// Load tests (simple glob of micro/tests/*.microtest.mjs)
import { readdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
const testDir = path.resolve(process.cwd(), 'micro/tests');
let loaded = 0;
for (const f of readdirSync(testDir)) {
  if (f.endsWith('.microtest.mjs')) {
    await import(pathToFileURL(path.join(testDir, f)).href);
    loaded++;
  }
}
console.log(`[micro] Loaded ${loaded} test file(s).`);

// Run
const start = Date.now();
let failed = 0;
let passed = 0;
// Run beforeAll hooks sequentially
for (const hook of beforeAllHooks) {
  await hook();
}
for (const t of tests) {
  const tStart = Date.now();
  try {
    const maybe = t.fn();
    if (maybe && typeof maybe.then === 'function') await maybe;
    passed++;
    console.log(`✔ ${t.name} (${Date.now() - tStart}ms)`);
  } catch (e) {
    failed++;
    console.error(`✖ ${t.name}: ${e.message}`);
    if (process.env.MICRO_TEST_BAIL) break;
  }
}
for (const hook of afterAllHooks) {
  try {
    await hook();
  } catch {
    /* ignore */
  }
}
const duration = Date.now() - start;
console.log(
  `\n[micro] Result: ${passed} passed, ${failed} failed in ${duration}ms`
);
if (failed > 0) process.exit(1);
