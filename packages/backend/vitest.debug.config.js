import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['diag.test.js'],
    watch: false,
    environment: 'node',
    globals: true,
    reporters: ['default'],
    silent: false,
    logHeapUsage: true,
  }
});
