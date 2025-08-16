// Jest configuration for microservices communication tests
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: [
    '<rootDir>/tests/microservices-communication-basic.test.js',
    '<rootDir>/tests/microservices-communication-schema-basic.test.js',
  ],
  setupFiles: ['<rootDir>/tests/jest.env.setup.js'],
  transform: {
    '^.+\\.js$': ['babel-jest', { rootMode: 'upward' }],
  },
  moduleFileExtensions: ['js', 'mjs', 'cjs', 'json'],
  testPathIgnorePatterns: [
    '/node_modules/',
    '<rootDir>/src/opentelemetry/upstream-source/',
  ],
  verbose: true,
  collectCoverage: false,
  testTimeout: 60000, // Extended timeout for microservices tests
};
