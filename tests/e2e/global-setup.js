/**
 * @fileoverview Global Setup for E2E Tests
 * Initializes test environment, database, and creates test data
 */

import { chromium } from '@playwright/test';
import { Pool } from 'pg';
import fs from 'fs/promises';
import path from 'path';

async function globalSetup() {
  console.log('🚀 Starting E2E test global setup...');
  
  try {
    // Create test results directories
    await createTestDirectories();
    
    // Setup test database
    await setupTestDatabase();
    
    // Setup authentication for tests
    await setupAuthentication();
    
    console.log('✅ E2E test global setup completed successfully');
  } catch (error) {
    console.error('❌ E2E test global setup failed:', error);
    throw error;
  }
}

/**
 * Create necessary test directories
 */
async function createTestDirectories() {
  const directories = [
    'test-results',
    'test-results/auth',
    'test-results/screenshots',
    'test-results/videos',
    'test-results/traces',
    'test-results/e2e-artifacts',
    'test-results/e2e-report'
  ];

  for (const dir of directories) {
    try {
      await fs.mkdir(dir, { recursive: true });
    } catch (error) {
      // Directory might already exist
      if (error.code !== 'EEXIST') {
        throw error;
      }
    }
  }
  
  console.log('📁 Created test directories');
}

/**
 * Setup test database with clean state
 */
async function setupTestDatabase() {
  const dbConfig = {
    host: process.env.E2E_DB_HOST || 'localhost',
    port: process.env.E2E_DB_PORT || 5432,
    user: process.env.E2E_DB_USER || 'postgres',
    password: process.env.E2E_DB_PASSWORD || 'postgres',
    database: 'postgres' // Connect to default database first
  };

  const adminPool = new Pool(dbConfig);
  const testDbName = 'cartrita_e2e_test';

  try {
    // Drop existing test database
    try {
      await adminPool.query(`DROP DATABASE IF EXISTS "${testDbName}"`);
    } catch (error) {
      console.warn(`Warning dropping database: ${error.message}`);
    }

    // Create fresh test database
    await adminPool.query(`CREATE DATABASE "${testDbName}"`);
    console.log(`📊 Created test database: ${testDbName}`);

    // Connect to test database and apply schema
    const testPool = new Pool({
      ...dbConfig,
      database: testDbName
    });

    // Apply database schema
    const schemaFiles = [
      '00_setup_pgvector.sql',
      '06_comprehensive_cartrita_schema.sql'
    ];

    for (const fileName of schemaFiles) {
      const schemaPath = path.join('db-init', fileName);
      try {
        const schema = await fs.readFile(schemaPath, 'utf8');
        const statements = schema.split(';').filter(stmt => stmt.trim());
        
        for (const statement of statements) {
          if (statement.trim()) {
            await testPool.query(statement);
          }
        }
        console.log(`📋 Applied schema: ${fileName}`);
      } catch (error) {
        console.warn(`Warning applying schema ${fileName}: ${error.message}`);
      }
    }

    // Create test data
    await createTestData(testPool);

    await testPool.end();
    
  } catch (error) {
    console.error('Database setup error:', error);
    throw error;
  } finally {
    await adminPool.end();
  }
}

/**
 * Create test data for E2E tests
 */
async function createTestData(pool) {
  // Create test users
  const testUsers = [
    {
      name: 'E2E Test User',
      email: 'e2etest@example.com',
      password_hash: '$2b$10$test.hash.for.e2e.testing.user'
    },
    {
      name: 'Admin Test User',
      email: 'admin@example.com',
      password_hash: '$2b$10$admin.hash.for.e2e.testing.user'
    }
  ];

  for (const user of testUsers) {
    try {
      const result = await pool.query(
        `INSERT INTO users (name, email, password_hash, created_at, updated_at) 
         VALUES ($1, $2, $3, NOW(), NOW()) 
         RETURNING id, name, email`,
        [user.name, user.email, user.password_hash]
      );
      
      console.log(`👤 Created test user: ${result.rows[0].email}`);
      
      // Create test conversation for user
      const convResult = await pool.query(
        `INSERT INTO conversations (user_id, title, created_at, updated_at)
         VALUES ($1, $2, NOW(), NOW())
         RETURNING id`,
        [result.rows[0].id, `${user.name}'s Test Conversation`]
      );

      // Add test messages
      await pool.query(
        `INSERT INTO conversation_messages (conversation_id, role, content, created_at)
         VALUES ($1, 'user', 'Hello, I need help with AI development', NOW()),
                ($1, 'assistant', 'I''d be happy to help you with AI development. What specific aspect are you working on?', NOW())`,
        [convResult.rows[0].id]
      );

      // Create test workflow
      await pool.query(
        `INSERT INTO workflows (user_id, name, description, definition, is_active, created_at, updated_at)
         VALUES ($1, $2, $3, $4, true, NOW(), NOW())`,
        [
          result.rows[0].id,
          `${user.name}'s Test Workflow`,
          'A sample workflow for E2E testing',
          JSON.stringify({
            nodes: [
              { id: 'trigger', type: 'manual', position: { x: 100, y: 100 } },
              { id: 'process', type: 'transform', position: { x: 300, y: 100 } }
            ],
            edges: [{ source: 'trigger', target: 'process' }]
          })
        ]
      );

    } catch (error) {
      console.warn(`Warning creating test user ${user.email}: ${error.message}`);
    }
  }

  console.log('🎯 Created test data');
}

/**
 * Setup authentication for authenticated tests
 */
async function setupAuthentication() {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Navigate to login page
    await page.goto('http://localhost:3001/login');
    
    // Wait for login form
    await page.waitForSelector('form', { timeout: 10000 });
    
    // Fill login form
    await page.fill('input[type="email"]', 'e2etest@example.com');
    await page.fill('input[type="password"]', 'TestPassword123!');
    
    // Submit login
    await page.click('button[type="submit"]');
    
    // Wait for successful login (redirect to dashboard)
    await page.waitForURL('**/dashboard', { timeout: 10000 });
    
    // Save authentication state
    await context.storageState({ 
      path: 'test-results/auth/user.json' 
    });
    
    console.log('🔐 Saved authentication state for tests');
    
  } catch (error) {
    console.warn('Warning setting up authentication - will use API auth fallback:', error.message);
    
    // Create a fallback auth file with API token
    const fallbackAuth = {
      cookies: [],
      origins: [{
        origin: 'http://localhost:3001',
        localStorage: [{
          name: 'auth_token',
          value: 'test-jwt-token-for-e2e'
        }]
      }]
    };
    
    await fs.writeFile(
      'test-results/auth/user.json',
      JSON.stringify(fallbackAuth, null, 2)
    );
    
    console.log('🔑 Created fallback authentication state');
    
  } finally {
    await context.close();
    await browser.close();
  }
}

export default globalSetup;
