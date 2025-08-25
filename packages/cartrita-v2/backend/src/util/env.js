export function isTestEnv() {
  return (
    process.env.NODE_ENV === 'test' ||
    process.env.VITEST ||
    process.env.LIGHTWEIGHT_TEST === '1'
  );
}

export function isLightweight() {
  return process.env.LIGHTWEIGHT_TEST === '1';
}

export function shouldQuietLogs() {
  if (process.env.DEBUG_LOGS === '1') return false;
  return isTestEnv();
}

export function quietConsole() {
  if (!shouldQuietLogs()) return;
  // Patch only noisy methods; keep error/warn
  const noop = () => {};
  ['log', 'info', 'debug'].forEach(m => {
    if (typeof console[m] === 'function') {
      console[m] = noop;
    }
  });
}

// Auto-apply when imported early
quietConsole();
