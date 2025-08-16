/**
 * @fileoverview Jest Integration Global Teardown
 * Global teardown for integration tests
 */

export default async () => {
  const testDatabase = global.__TEST_DATABASE__;
  
  if (testDatabase) {
    await testDatabase.close();
  }
  
  console.log('Integration test environment cleaned up');
};
