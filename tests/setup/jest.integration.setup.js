/**
 * @fileoverview Jest Integration Setup
 * Setup configuration for integration tests
 */

import { TestDatabase } from '../utils/TestDatabase.js';

// Set test environment
process.env.NODE_ENV = 'test';

// Test database instance
let testDatabase;

// Setup before each test
beforeEach(async () => {
  if (!testDatabase) {
    testDatabase = new TestDatabase();
    await testDatabase.initialize();
  }
  
  // Clean database before each test
  await testDatabase.cleanup();
  
  // Setup test data
  await testDatabase.seedTestData();
});

// Cleanup after each test
afterEach(async () => {
  if (testDatabase) {
    await testDatabase.cleanup();
  }
});

// Global teardown
afterAll(async () => {
  if (testDatabase) {
    await testDatabase.close();
  }
});

// Make test database available globally
global.testDatabase = testDatabase;
