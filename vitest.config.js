import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.js'],
    coverage: {
      provider: 'v8',
      include: ['packages/backend/src/**/*.js', 'tests/utils/**/*.js'],
      exclude: ['packages/backend/src/**/*.test.js', 'packages/backend/src/test/**']
    }
  }
});
