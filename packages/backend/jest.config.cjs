// Jest configuration (CJS) for backend tests - Simplified for development
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: [
    '<rootDir>/tests/unit/**/*.test.js',
  ],
  moduleFileExtensions: ['js', 'mjs', 'cjs', 'json'],
  testPathIgnorePatterns: [
    '/node_modules/',
    '\\.microtest\\.mjs$',
  ],
  verbose: true,
  collectCoverage: false,
};
