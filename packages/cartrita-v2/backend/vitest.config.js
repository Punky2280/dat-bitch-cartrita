import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    root: '.',
    include: [
      'tmp.vitest.test.js',
      'tests/registry/toolSchema.test.js',
      'tests/sanity.test.js',
    ],
    watch: false,
    environment: 'node',
    reporters: ['default'],
    silent: false,
    globals: true,
    setupFiles: ['./vitest.setup.mjs'],
    testTimeout: 8000,
    hookTimeout: 8000,
  },
});
