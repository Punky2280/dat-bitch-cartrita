// Jest configuration (CJS) for mixed ESM project
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/registry/**/*.test.js', '**/tests/sanity.test.js'],
  transform: { '^.+\\.js$': ['babel-jest', { presets: ['@babel/preset-env'] }] },
  moduleNameMapper: {},
  verbose: true,
};
