import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.js'],
    watch: false,
    environment: 'node',
    reporters: ['default'],
  silent: false,
  globals: true,
  }
});
