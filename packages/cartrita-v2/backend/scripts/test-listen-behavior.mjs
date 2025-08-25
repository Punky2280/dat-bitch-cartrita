// Lightweight integration test for startServer listen behavior
// Usage: AUTOSTART=0 LIGHTWEIGHT_TEST=1 node scripts/test-listen-behavior.mjs

const assert = (cond, msg) => {
  if (!cond) {
    console.error('Assertion failed:', msg);
    process.exit(1);
  }
};

console.log('[Test] Importing backend index with AUTOSTART=0 ...');
const mod = await import('../index.js');
const { app, server, startServer } = mod;

assert(
  !server.listening,
  'Server should not be listening immediately after import when AUTOSTART=0'
);
console.log('[Test] Passed: server not listening pre-start');

console.log('[Test] Calling startServer() ...');
await startServer();

setTimeout(() => {
  if (server.listening) {
    console.log('[Test] Passed: server is listening after startServer');
    process.exit(0);
  } else {
    console.error('[Test] Failed: server not listening after startServer');
    process.exit(1);
  }
}, 1200);
