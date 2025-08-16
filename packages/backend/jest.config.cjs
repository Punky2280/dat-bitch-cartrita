// Jest configuration (CJS) for backend tests
// Goals:
// - Run our backend tests under `tests/**` and `src/test/**`
// - Exclude upstream/vendor test trees (e.g., opentelemetry sources)
// - Keep micro-tests executed via `npm run test:micro` (do not match *.microtest.mjs here)

module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  // Limit collection to stable Jest tests; skip vitest-based and heavy integration suites
  testMatch: [
    '<rootDir>/tests/unit/**/*.test.js',
    '<rootDir>/tests/registry/registry.sanity.test.js',
    '<rootDir>/tests/router-endpoint.test.js',
  // no src/test patterns; that tree contains placeholders only
  ],
  setupFiles: ['<rootDir>/tests/jest.env.setup.js'],
  transform: {
    '^.+\\.js$': ['babel-jest', { rootMode: 'upward' }],
  },
  moduleFileExtensions: ['js', 'mjs', 'cjs', 'json'],
  testPathIgnorePatterns: [
    '/node_modules/',
    '<rootDir>/src/opentelemetry/upstream-source/',
    '\\.(disabled)$',
    '\\.microtest\\.mjs$',
  ],
  verbose: false,
  collectCoverage: false,
};
