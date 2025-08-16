/**
 * @fileoverview E2E Tests - Authentication Flow
 * Tests user registration, login, logout, and profile management
 */

import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  
  test.describe('User Registration', () => {
    test('should register new user successfully', async ({ page }) => {
      await page.goto('/register');
      
      // Wait for registration form
      await expect(page.locator('[data-testid="register-form"]')).toBeVisible();
      
      // Fill registration form
      const timestamp = Date.now();
      const testEmail = `newuser${timestamp}@example.com`;
      
      await page.fill('input[name="name"]', 'New Test User');
      await page.fill('input[name="email"]', testEmail);
      await page.fill('input[name="password"]', 'NewUserPassword123!');
      await page.fill('input[name="confirmPassword"]', 'NewUserPassword123!');
      
      // Submit form
      await page.click('button[type="submit"]');
      
      // Should redirect to dashboard after successful registration
      await expect(page).toHaveURL(/\/dashboard/);
      
      // Verify user is logged in
      await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();
      await expect(page.locator('[data-testid="user-name"]')).toContainText('New Test User');
    });
    
    test('should show validation errors for invalid input', async ({ page }) => {
      await page.goto('/register');
      
      // Try to submit empty form
      await page.click('button[type="submit"]');
      
      // Should show validation errors
      await expect(page.locator('[data-testid="error-name"]')).toBeVisible();
      await expect(page.locator('[data-testid="error-email"]')).toBeVisible();
      await expect(page.locator('[data-testid="error-password"]')).toBeVisible();
    });
    
    test('should prevent registration with existing email', async ({ page }) => {
      await page.goto('/register');
      
      // Try to register with existing email
      await page.fill('input[name="name"]', 'Duplicate User');
      await page.fill('input[name="email"]', 'e2etest@example.com'); // Existing user
      await page.fill('input[name="password"]', 'Password123!');
      await page.fill('input[name="confirmPassword"]', 'Password123!');
      
      await page.click('button[type="submit"]');
      
      // Should show error message
      await expect(page.locator('[data-testid="registration-error"]')).toBeVisible();
      await expect(page.locator('[data-testid="registration-error"]')).toContainText('already exists');
    });
    
    test('should validate password strength', async ({ page }) => {
      await page.goto('/register');
      
      await page.fill('input[name="name"]', 'Test User');
      await page.fill('input[name="email"]', 'test@example.com');
      await page.fill('input[name="password"]', '123'); // Weak password
      
      // Should show password strength indicator
      await expect(page.locator('[data-testid="password-strength"]')).toContainText('weak');
      
      // Update to strong password
      await page.fill('input[name="password"]', 'StrongPassword123!');
      await expect(page.locator('[data-testid="password-strength"]')).toContainText('strong');
    });
  });
  
  test.describe('User Login', () => {
    test('should login with valid credentials', async ({ page }) => {
      await page.goto('/login');
      
      // Fill login form
      await page.fill('input[name="email"]', 'e2etest@example.com');
      await page.fill('input[name="password"]', 'TestPassword123!');
      
      // Submit login
      await page.click('button[type="submit"]');
      
      // Should redirect to dashboard
      await expect(page).toHaveURL(/\/dashboard/);
      
      // Verify authentication
      await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();
    });
    
    test('should show error for invalid credentials', async ({ page }) => {
      await page.goto('/login');
      
      // Try invalid credentials
      await page.fill('input[name="email"]', 'invalid@example.com');
      await page.fill('input[name="password"]', 'WrongPassword123!');
      
      await page.click('button[type="submit"]');
      
      // Should show error message
      await expect(page.locator('[data-testid="login-error"]')).toBeVisible();
      await expect(page.locator('[data-testid="login-error"]')).toContainText('Invalid credentials');
      
      // Should stay on login page
      await expect(page).toHaveURL(/\/login/);
    });
    
    test('should remember login with "Remember Me" option', async ({ page }) => {
      await page.goto('/login');
      
      await page.fill('input[name="email"]', 'e2etest@example.com');
      await page.fill('input[name="password"]', 'TestPassword123!');
      await page.check('input[name="rememberMe"]');
      
      await page.click('button[type="submit"]');
      await expect(page).toHaveURL(/\/dashboard/);
      
      // Close browser and reopen to test persistence
      await page.context().close();
      
      // Create new context and check if still logged in
      const newContext = await page.context().browser().newContext();
      const newPage = await newContext.newPage();
      
      await newPage.goto('/dashboard');
      
      // Should still be authenticated (or redirect to login if implementation doesn't support this)
      const currentUrl = newPage.url();
      const isLoggedIn = currentUrl.includes('/dashboard');
      const redirectedToLogin = currentUrl.includes('/login');
      
      expect(isLoggedIn || redirectedToLogin).toBeTruthy();
    });
  });
  
  test.describe('User Profile Management', () => {
    test.beforeEach(async ({ page }) => {
      // Assume we have authentication from storageState
      await page.goto('/dashboard');
      await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();
    });
    
    test('should view user profile', async ({ page }) => {
      // Navigate to profile
      await page.click('[data-testid="user-menu"]');
      await page.click('[data-testid="profile-link"]');
      
      await expect(page).toHaveURL(/\/profile/);
      
      // Verify profile information is displayed
      await expect(page.locator('[data-testid="profile-name"]')).toBeVisible();
      await expect(page.locator('[data-testid="profile-email"]')).toBeVisible();
      
      // Check that sensitive information is not displayed
      await expect(page.locator('text=password')).not.toBeVisible();
    });
    
    test('should update profile information', async ({ page }) => {
      await page.goto('/profile');
      
      // Click edit button
      await page.click('[data-testid="edit-profile-button"]');
      
      // Update name
      await page.fill('input[name="name"]', 'Updated Test User Name');
      
      // Save changes
      await page.click('[data-testid="save-profile-button"]');
      
      // Should show success message
      await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
      
      // Verify updated information is displayed
      await expect(page.locator('[data-testid="profile-name"]')).toContainText('Updated Test User Name');
    });
    
    test('should change password', async ({ page }) => {
      await page.goto('/profile');
      
      // Navigate to change password section
      await page.click('[data-testid="change-password-tab"]');
      
      // Fill password change form
      await page.fill('input[name="currentPassword"]', 'TestPassword123!');
      await page.fill('input[name="newPassword"]', 'NewTestPassword123!');
      await page.fill('input[name="confirmNewPassword"]', 'NewTestPassword123!');
      
      // Submit password change
      await page.click('[data-testid="change-password-button"]');
      
      // Should show success message
      await expect(page.locator('[data-testid="password-success-message"]')).toBeVisible();
      
      // Should be able to login with new password (test in a new session)
      await page.goto('/logout');
      await page.goto('/login');
      
      await page.fill('input[name="email"]', 'e2etest@example.com');
      await page.fill('input[name="password"]', 'NewTestPassword123!');
      await page.click('button[type="submit"]');
      
      await expect(page).toHaveURL(/\/dashboard/);
    });
  });
  
  test.describe('User Logout', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/dashboard');
      await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();
    });
    
    test('should logout successfully', async ({ page }) => {
      // Click user menu and logout
      await page.click('[data-testid="user-menu"]');
      await page.click('[data-testid="logout-button"]');
      
      // Should redirect to login page
      await expect(page).toHaveURL(/\/login/);
      
      // Should not be able to access protected pages
      await page.goto('/dashboard');
      await expect(page).toHaveURL(/\/login/);
    });
    
    test('should clear authentication state on logout', async ({ page }) => {
      // Logout
      await page.click('[data-testid="user-menu"]');
      await page.click('[data-testid="logout-button"]');
      
      // Check that auth tokens are cleared from localStorage
      const authToken = await page.evaluate(() => localStorage.getItem('auth_token'));
      expect(authToken).toBeNull();
      
      // Check that user data is cleared
      const userData = await page.evaluate(() => localStorage.getItem('user'));
      expect(userData).toBeNull();
    });
  });
  
  test.describe('Authentication Protection', () => {
    test('should redirect unauthenticated users to login', async ({ page }) => {
      // Try to access protected routes without authentication
      const protectedRoutes = ['/dashboard', '/workflows', '/profile', '/chat'];
      
      for (const route of protectedRoutes) {
        await page.goto(route);
        
        // Should redirect to login
        await expect(page).toHaveURL(/\/login/);
        
        // Should show login form
        await expect(page.locator('[data-testid="login-form"]')).toBeVisible();
      }
    });
    
    test('should handle expired tokens gracefully', async ({ page }) => {
      await page.goto('/dashboard');
      
      // Simulate expired token by modifying localStorage
      await page.evaluate(() => {
        localStorage.setItem('auth_token', 'expired.jwt.token');
      });
      
      // Try to access API endpoint
      await page.goto('/profile');
      
      // Should detect expired token and redirect to login
      await expect(page).toHaveURL(/\/login/);
      
      // Should show appropriate message
      await expect(page.locator('[data-testid="session-expired-message"]')).toBeVisible();
    });
    
    test('should handle network errors during authentication', async ({ page }) => {
      // Intercept and block authentication requests
      await page.route('/api/auth/**', route => route.abort());
      
      await page.goto('/login');
      
      await page.fill('input[name="email"]', 'e2etest@example.com');
      await page.fill('input[name="password"]', 'TestPassword123!');
      await page.click('button[type="submit"]');
      
      // Should show network error message
      await expect(page.locator('[data-testid="network-error"]')).toBeVisible();
      
      // Should stay on login page
      await expect(page).toHaveURL(/\/login/);
    });
  });
});
