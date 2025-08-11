// Jest configuration (ESM) - only test/ directory scanned; src excluded to avoid vendor upstream tests
module.exports = {
  testEnvironment: 'node',
    roots: ['<rootDir>/tests/unit', '<rootDir>/tests/integration'], // updated to new tests directory
  testMatch: ['**/?(*.)+(test).[jt]s'],
  setupFiles: ['<rootDir>/test/jest.env.setup.js'],
  // All .js already treated as ESM via package.json "type":"module"; no transform needed.
  transform: {
    '^.+\\.js$': ['babel-jest', { rootMode: 'upward' }]
  },
  moduleFileExtensions: ['js','mjs','cjs','json'],
  // Let node_modules ESM/CJS load natively (no transform). If specific CJS needs transforming later, add here.
  transformIgnorePatterns: [],
  testPathIgnorePatterns: [
    '/node_modules/',
    'unix-socket-handshake.test.js',
    '<rootDir>/src/opentelemetry/upstream-source/'
  ],
  verbose: false,
  collectCoverage: false,
  // Explicitly disable automatic CommonJS interop assumptions.
  // Using default resolver is fine; ensure exports field respected.
};
