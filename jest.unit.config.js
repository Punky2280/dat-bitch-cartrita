export default {
  // Test environment
  testEnvironment: 'node',
  
  // Root directory
  rootDir: '.',
  
  // Test file patterns
  testMatch: [
    '<rootDir>/tests/unit/**/*.test.js',
    '<rootDir>/packages/*/tests/unit/**/*.test.js'
  ],
  
  // Ignore patterns
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/build/',
    '/coverage/'
  ],
  
  // Setup files
  setupFilesAfterEnv: [
    '<rootDir>/tests/setup/jest.setup.js'
  ],
  
  // Module file extensions
  moduleFileExtensions: [
    'js',
    'json',
    'jsx',
    'ts',
    'tsx'
  ],
  
  // Transform files
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': 'babel-jest'
  },

  // ES Module support
  extensionsToTreatAsEsm: ['.js'],
  transformIgnorePatterns: [
    'node_modules/(?!(chalk|strip-ansi|ansi-regex)/)'
  ],
  
  // Module name mapping
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@backend/(.*)$': '<rootDir>/packages/backend/src/$1',
    '^@frontend/(.*)$': '<rootDir>/packages/frontend/src/$1',
    '^@shared/(.*)$': '<rootDir>/packages/shared/src/$1'
  },
  
  // Coverage configuration
  collectCoverage: true,
  coverageDirectory: '<rootDir>/coverage/unit',
  coverageReporters: [
    'text',
    'html',
    'lcov',
    'clover'
  ],
  
  // Coverage collection patterns
  collectCoverageFrom: [
    'packages/*/src/**/*.{js,ts}',
    '!packages/*/src/**/*.d.ts',
    '!packages/*/src/**/*.test.{js,ts}',
    '!packages/*/src/**/__tests__/**',
    '!packages/*/src/**/node_modules/**'
  ],
  
  // Coverage thresholds
  coverageThreshold: {
    global: {
      branches: 75,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  
  // Clear mocks between tests
  clearMocks: true,
  
  // Restore mocks after each test
  restoreMocks: true,
  
  // Verbose output
  verbose: true,
  
  // Max workers for parallel tests
  maxWorkers: '50%',
  
  // Test timeout
  testTimeout: 30000
};
