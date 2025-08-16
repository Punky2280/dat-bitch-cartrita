import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E Testing Configuration
 * Comprehensive end-to-end testing setup for Cartrita multi-agent system
 */
export default defineConfig({
  // Test directory
  testDir: './tests/e2e',
  
  // Run tests in files in parallel
  fullyParallel: true,
  
  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,
  
  // Retry on CI only
  retries: process.env.CI ? 2 : 0,
  
  // Opt out of parallel tests on CI
  workers: process.env.CI ? 1 : undefined,
  
  // Reporter to use
  reporter: [
    ['html', { outputFolder: 'test-results/e2e-report' }],
    ['json', { outputFile: 'test-results/e2e-results.json' }],
    ['junit', { outputFile: 'test-results/e2e-results.xml' }],
    process.env.CI ? ['github'] : ['list']
  ],
  
  // Shared settings for all projects
  use: {
    // Base URL for tests
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3001',
    
    // Collect trace on failure
    trace: 'on-first-retry',
    
    // Take screenshot on failure
    screenshot: 'only-on-failure',
    
    // Record video on failure
    video: 'retain-on-failure',
    
    // Global timeout for each test
    actionTimeout: 30000,
    
    // Global navigation timeout
    navigationTimeout: 30000,
    
    // Ignore HTTPS errors
    ignoreHTTPSErrors: true
  },
  
  // Global test timeout
  timeout: 120000,
  
  // Expect timeout
  expect: {
    timeout: 10000
  },
  
  // Configure projects for major browsers
  projects: [
    // Setup project - runs before all tests
    {
      name: 'setup',
      testMatch: /.*\.setup\.js/,
      teardown: 'cleanup'
    },
    
    // Cleanup project - runs after all tests
    {
      name: 'cleanup',
      testMatch: /.*\.cleanup\.js/
    },

    // Desktop Browsers
    {
      name: 'chromium',
      use: { 
        ...devices['Desktop Chrome'],
        // Use prepared authentication state
        storageState: 'test-results/auth/user.json'
      },
      dependencies: ['setup']
    },
    
    {
      name: 'firefox',
      use: { 
        ...devices['Desktop Firefox'],
        storageState: 'test-results/auth/user.json'
      },
      dependencies: ['setup']
    },
    
    {
      name: 'webkit',
      use: { 
        ...devices['Desktop Safari'],
        storageState: 'test-results/auth/user.json'
      },
      dependencies: ['setup']
    },

    // Mobile Browsers
    {
      name: 'Mobile Chrome',
      use: { 
        ...devices['Pixel 5'],
        storageState: 'test-results/auth/user.json'
      },
      dependencies: ['setup']
    },
    
    {
      name: 'Mobile Safari',
      use: { 
        ...devices['iPhone 12'],
        storageState: 'test-results/auth/user.json'
      },
      dependencies: ['setup']
    },

    // API Testing (headless)
    {
      name: 'api',
      use: {
        baseURL: process.env.E2E_API_URL || 'http://localhost:3000/api'
      },
      testMatch: /.*\.api\.e2e\.js/,
      dependencies: ['setup']
    }
  ],

  // Configure local dev server
  webServer: [
    // Backend server
    {
      command: 'npm run dev:backend',
      port: 3000,
      timeout: 60000,
      reuseExistingServer: !process.env.CI,
      cwd: './packages/backend',
      env: {
        NODE_ENV: 'test',
        PORT: '3000',
        DB_NAME: 'cartrita_e2e_test',
        REDIS_DB: '15' // Use separate Redis DB for E2E tests
      }
    },
    
    // Frontend server
    {
      command: 'npm run dev',
      port: 3001,
      timeout: 60000,
      reuseExistingServer: !process.env.CI,
      cwd: './packages/frontend',
      env: {
        NODE_ENV: 'test',
        VITE_API_URL: 'http://localhost:3000/api'
      }
    }
  ],

  // Global setup and teardown
  globalSetup: require.resolve('./tests/e2e/global-setup.js'),
  globalTeardown: require.resolve('./tests/e2e/global-teardown.js'),

  // Test match patterns
  testMatch: [
    '**/tests/e2e/**/*.e2e.js',
    '**/tests/e2e/**/*.test.js'
  ],

  // Test ignore patterns
  testIgnore: [
    '**/node_modules/**',
    '**/test-results/**',
    '**/*.setup.js',
    '**/*.cleanup.js'
  ],

  // Output directory for test artifacts
  outputDir: 'test-results/e2e-artifacts',
  
  // Metadata
  metadata: {
    'test-suite': 'Cartrita E2E Tests',
    'version': '1.0.0',
    'environment': process.env.NODE_ENV || 'test'
  }
});
