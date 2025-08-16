export default {
  displayName: 'Unit Tests',
  testEnvironment: 'node',
  testMatch: [
    '<rootDir>/tests/unit/**/*.test.js',
    '<rootDir>/packages/*/tests/unit/**/*.test.js'
  ],
  setupFilesAfterEnv: [
    '<rootDir>/tests/setup/jest.setup.js'
  ],
  collectCoverageFrom: [
    'packages/backend/src/**/*.js',
    'tests/utils/**/*.js',
    '!packages/backend/src/**/*.test.js',
    '!packages/backend/src/test/**',
    '!**/node_modules/**'
  ],
  coverageThreshold: {
    global: {
      statements: 80,
      branches: 75,
      functions: 80,
      lines: 80
    }
  }
};
