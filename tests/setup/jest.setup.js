/**
 * @fileoverview Jest Setup - Unit Tests
 * Setup configuration for unit tests with mocks and utilities
 */

import { jest, expect, afterEach } from '@jest/globals';

// Set test environment
process.env.NODE_ENV = 'test';

// Setup console
global.console = {
  ...console,
  // Suppress console output during tests
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
  debug: jest.fn()
};

// Global test utilities
global.testUtils = {
  delay: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
  createMockRequest: (overrides = {}) => ({
    body: {},
    params: {},
    query: {},
    headers: {},
    user: null,
    ...overrides
  }),
  createMockResponse: () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    res.send = jest.fn().mockReturnValue(res);
    res.end = jest.fn().mockReturnValue(res);
    return res;
  }
};

// Setup Jest matchers
expect.extend({
  toBeValidId(received) {
    const pass = typeof received === 'string' || typeof received === 'number';
    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid ID`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid ID`,
        pass: false,
      };
    }
  },
  
  toBeValidTimestamp(received) {
    const pass = !isNaN(Date.parse(received));
    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid timestamp`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid timestamp`,
        pass: false,
      };
    }
  },

  toBeFunction(received) {
    const pass = typeof received === 'function';
    if (pass) {
      return {
        message: () => `expected ${received} not to be a function`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be a function`,
        pass: false,
      };
    }
  }
});

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
});
