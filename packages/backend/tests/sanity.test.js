import { describe, test, expect } from 'vitest';
console.log('[sanity.test] loaded');

describe('sanity', () => {
  test('adds numbers', () => {
    expect(1 + 2).toBe(3);
  });
});
