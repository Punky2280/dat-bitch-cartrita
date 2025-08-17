// Jest environment setup for backend tests
// This file configures the test environment for the Cartrita backend test suite

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.USE_COMPOSITE_REGISTRY = '1';
process.env.REGISTRY_PHASE_MAX = '0';
process.env.MINIMAL_REGISTRY = '1';
process.env.LIGHTWEIGHT_TEST = '1';

console.log('[jest.setup] environment variables prepared');

// Debug: show test globals to confirm Jest runtime started
if (typeof global.expect === 'function') {
  console.log('[jest.setup] expect global present');
} else {
  console.log('[jest.setup] expect global MISSING');
}

// Set up global test timeout
jest.setTimeout(30000);