import { test, expect } from 'vitest';
console.log('[tmp.vitest.test] loaded');

test('tmp arithmetic', () => {
  expect(2+2).toBe(4);
});
