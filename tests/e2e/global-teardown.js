/**
 * @fileoverview Global Teardown for E2E Tests
 * Cleans up test environment and resources after all tests complete
 */

import { Pool } from 'pg';
import fs from 'fs/promises';

async function globalTeardown() {
  console.log('🧹 Starting E2E test global teardown...');
  
  try {
    // Cleanup test database
    await cleanupTestDatabase();
    
    // Archive test artifacts
    await archiveTestArtifacts();
    
    console.log('✅ E2E test global teardown completed successfully');
  } catch (error) {
    console.error('❌ E2E test global teardown failed:', error);
    // Don't throw error in teardown to avoid masking test failures
  }
}

/**
 * Cleanup test database
 */
async function cleanupTestDatabase() {
  // Only cleanup if not in CI or if explicitly requested
  if (process.env.CI && !process.env.E2E_CLEANUP_DB) {
    console.log('⏭️  Skipping database cleanup in CI environment');
    return;
  }

  const dbConfig = {
    host: process.env.E2E_DB_HOST || 'localhost',
    port: process.env.E2E_DB_PORT || 5432,
    user: process.env.E2E_DB_USER || 'postgres',
    password: process.env.E2E_DB_PASSWORD || 'postgres',
    database: 'postgres'
  };

  const adminPool = new Pool(dbConfig);
  const testDbName = 'cartrita_e2e_test';

  try {
    // Terminate connections to test database
    await adminPool.query(`
      SELECT pg_terminate_backend(pid) 
      FROM pg_stat_activity 
      WHERE datname = $1 AND pid <> pg_backend_pid()
    `, [testDbName]);

    // Drop test database
    await adminPool.query(`DROP DATABASE IF EXISTS "${testDbName}"`);
    console.log(`🗑️  Dropped test database: ${testDbName}`);
    
  } catch (error) {
    console.warn(`Warning cleaning up database: ${error.message}`);
  } finally {
    await adminPool.end();
  }
}

/**
 * Archive test artifacts for CI/reporting
 */
async function archiveTestArtifacts() {
  if (!process.env.CI) {
    console.log('⏭️  Skipping artifact archival in local environment');
    return;
  }

  try {
    // Create archive directory with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const archiveDir = `test-results/archive-${timestamp}`;
    
    await fs.mkdir(archiveDir, { recursive: true });

    // Archive important artifacts
    const artifactDirs = [
      'test-results/e2e-report',
      'test-results/screenshots',
      'test-results/videos',
      'test-results/traces'
    ];

    for (const dir of artifactDirs) {
      try {
        await fs.cp(dir, `${archiveDir}/${dir.split('/').pop()}`, { 
          recursive: true 
        });
      } catch (error) {
        // Directory might not exist if no failures occurred
        if (error.code !== 'ENOENT') {
          console.warn(`Warning archiving ${dir}: ${error.message}`);
        }
      }
    }

    // Copy result files
    const resultFiles = [
      'test-results/e2e-results.json',
      'test-results/e2e-results.xml'
    ];

    for (const file of resultFiles) {
      try {
        await fs.cp(file, `${archiveDir}/${file.split('/').pop()}`);
      } catch (error) {
        if (error.code !== 'ENOENT') {
          console.warn(`Warning archiving ${file}: ${error.message}`);
        }
      }
    }

    console.log(`📦 Archived test artifacts to: ${archiveDir}`);
    
  } catch (error) {
    console.warn(`Warning archiving artifacts: ${error.message}`);
  }
}

export default globalTeardown;
