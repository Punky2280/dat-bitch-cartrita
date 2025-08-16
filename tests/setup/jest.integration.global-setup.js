/**
 * @fileoverview Jest Integration Global Setup
 * Global setup for integration tests
 */

import { TestDatabase } from '../utils/TestDatabase.js';

export default async () => {
  // Setup test database
  const testDatabase = new TestDatabase();
  await testDatabase.initialize();
  
  // Store for teardown
  global.__TEST_DATABASE__ = testDatabase;
  
  console.log('Integration test environment initialized');
};
