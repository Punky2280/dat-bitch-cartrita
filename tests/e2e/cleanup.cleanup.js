/**
 * @fileoverview E2E Test Cleanup
 * Cleanup operations after all E2E tests complete
 */

import { test as cleanup } from '@playwright/test';

cleanup('cleanup test environment', async ({ page }) => {
  console.log('🧹 Cleaning up E2E test environment...');
  
  try {
    // Clear browser storage
    await page.context().clearCookies();
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    
    // Clear any test data if needed
    // (Most cleanup is handled in global-teardown.js)
    
    console.log('✅ E2E test cleanup completed');
    
  } catch (error) {
    console.warn('⚠️  E2E cleanup warning:', error.message);
    // Don't fail cleanup - just log warnings
  }
});
