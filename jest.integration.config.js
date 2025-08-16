export default {
  // Test environment
  testEnvironment: 'node',
  
  // Root directory
  rootDir: '.',
  
  // Test file patterns
  testMatch: [
    '<rootDir>/tests/integration/**/*.test.js',
    '<rootDir>/packages/*/tests/integration/**/*.test.js'
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
    '<rootDir>/tests/setup/jest.integration.setup.js'
  ],
  
  // Global setup and teardown for database
  globalSetup: '<rootDir>/tests/setup/jest.integration.global-setup.js',
  globalTeardown: '<rootDir>/tests/setup/jest.integration.global-teardown.js',
  
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
  
  // Module name mapping
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@backend/(.*)$': '<rootDir>/packages/backend/src/$1',
    '^@frontend/(.*)$': '<rootDir>/packages/frontend/src/$1',
    '^@shared/(.*)$': '<rootDir>/packages/shared/src/$1'
  },
  
  // Coverage configuration
  collectCoverage: true,
  coverageDirectory: '<rootDir>/coverage/integration',
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
      branches: 70,
      functions: 75,
      lines: 75,
      statements: 75
    }
  },
  
  // Clear mocks between tests
  clearMocks: true,
  
  // Restore mocks after each test
  restoreMocks: true,
  
  // Verbose output
  verbose: true,
  
  // Run tests in series for integration tests
  maxWorkers: 1,
  
  // Longer timeout for integration tests
  testTimeout: 60000,
  
  // Force exit after tests complete
  forceExit: true,
  
  // Detect open handles
  detectOpenHandles: true
};
