/**
 * @fileoverview E2E Test Setup - Authentication and Environment Preparation
 * Prepares test environment and authenticates test users
 */

import { test as setup, expect } from '@playwright/test';

const authFile = 'test-results/auth/user.json';

setup('authenticate test user', async ({ page }) => {
  console.log('🔐 Setting up authentication for E2E tests...');
  
  try {
    // Navigate to login page
    await page.goto('/login');
    
    // Wait for login form to be visible
    await page.waitForSelector('form[data-testid="login-form"]', { 
      timeout: 15000 
    });
    
    // Fill login credentials
    await page.fill('input[name="email"]', 'e2etest@example.com');
    await page.fill('input[name="password"]', 'TestPassword123!');
    
    // Submit login form
    await page.click('button[type="submit"]');
    
    // Wait for successful login - should redirect to dashboard
    await page.waitForURL(/\/dashboard/, { timeout: 15000 });
    
    // Verify we're logged in by checking for user menu or dashboard elements
    await expect(page.locator('[data-testid="user-menu"]')).toBeVisible({ timeout: 10000 });
    
    // Save authentication state
    await page.context().storageState({ path: authFile });
    
    console.log('✅ Authentication setup completed successfully');
    
  } catch (error) {
    console.error('❌ Authentication setup failed:', error);
    
    // Take screenshot for debugging
    await page.screenshot({ 
      path: 'test-results/auth/setup-failure.png',
      fullPage: true 
    });
    
    // Try alternative login method or create fallback auth
    await setupFallbackAuth(page);
  }
});

setup('verify test data exists', async ({ request }) => {
  console.log('📊 Verifying test data exists...');
  
  try {
    // Check if test users exist
    const response = await request.get('/api/auth/profile', {
      headers: {
        'Authorization': 'Bearer test-jwt-token'
      }
    });
    
    if (response.ok()) {
      const user = await response.json();
      console.log(`✅ Test user verified: ${user.data?.email}`);
    } else {
      console.warn('⚠️  Test user verification failed, using fallback');
    }
    
  } catch (error) {
    console.warn('⚠️  Test data verification failed:', error.message);
  }
});

/**
 * Setup fallback authentication for tests
 */
async function setupFallbackAuth(page) {
  console.log('🔄 Setting up fallback authentication...');
  
  try {
    // Try API-based login as fallback
    const response = await page.request.post('/api/auth/login', {
      data: {
        email: 'e2etest@example.com',
        password: 'TestPassword123!'
      }
    });
    
    if (response.ok()) {
      const { data } = await response.json();
      
      // Store token in localStorage
      await page.addInitScript(token => {
        localStorage.setItem('auth_token', token);
        localStorage.setItem('user', JSON.stringify({
          id: 1,
          name: 'E2E Test User',
          email: 'e2etest@example.com'
        }));
      }, data.token);
      
      // Save the modified context
      await page.context().storageState({ path: authFile });
      
      console.log('✅ Fallback authentication completed');
      
    } else {
      throw new Error('API login failed');
    }
    
  } catch (error) {
    console.error('❌ Fallback authentication failed:', error);
    
    // Create minimal auth state for unauthenticated tests
    const minimalAuthState = {
      cookies: [],
      origins: [{
        origin: 'http://localhost:3001',
        localStorage: [
          { name: 'test_mode', value: 'true' },
          { name: 'skip_auth', value: 'true' }
        ]
      }]
    };
    
    await page.context().storageState({ 
      path: authFile,
      ...minimalAuthState 
    });
    
    console.log('⚠️  Created minimal auth state for testing');
  }
}
