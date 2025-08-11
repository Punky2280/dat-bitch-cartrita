import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
  include: ['**/tests/registry/**/*.test.js','**/tests/sanity.test.js'],
    environment: 'node',
    testTimeout: 8000,
    hookTimeout: 8000,
    globals: true,
    watch: false,
    reporters: ['default'],
    setupFiles: ['./vitest.setup.mjs']
  }
});
