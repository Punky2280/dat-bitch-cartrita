#!/usr/bin/env node

/**
 * PostgreSQL Vector Extension Setup Script
 *
 * This script sets up pgvector extension and creates optimized
 * knowledge hub tables with proper vector column types and indexes.
 */

import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url'; // Added for ES Module compatibility

// Load environment variables
import dotenv from 'dotenv';
dotenv.config();

// --- The Fix: Define __dirname for ES Modules ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Database configuration
const pool = new Pool({
  user: process.env.POSTGRES_USER || 'robert',
  // CORRECTED: Use the environment variable for the host to work in Docker
  host: process.env.POSTGRES_HOST || 'localhost',
  database: process.env.POSTGRES_DB || 'dat-bitch-cartrita',
  password: process.env.POSTGRES_PASSWORD || 'punky1',
  port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
});

async function setupPgVector() {
  const client = await pool.connect();
  try {
    console.log('🚀 Starting pgvector setup...');
    const setupSQL = fs.readFileSync(
      path.join(__dirname, 'setup_pgvector.sql'),
      'utf8'
    );

    console.log('📄 Executing pgvector setup SQL...');
    await client.query(setupSQL);
    console.log('✅ pgvector extension and tables installed successfully!');

    console.log('🔍 Verifying installation...');
    const extensionCheck = await client.query(
      "SELECT EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'vector') as vector_installed;"
    );
    if (extensionCheck.rows[0].vector_installed) {
      console.log('✅ pgvector extension is active');
    } else {
      throw new Error('❌ pgvector extension not found after setup');
    }

    // Further verification checks...
    console.log('🧪 Testing vector operations...');
    const vectorTest = await client.query(
      "SELECT '[1,0,0]'::vector <-> '[0,1,0]'::vector as distance;"
    );
    console.log(
      `✅ Vector distance test completed. Distance: ${vectorTest.rows[0].distance}`
    );

    console.log('\n🎉 pgvector setup completed successfully!');
  } catch (error) {
    console.error('❌ Error setting up pgvector:', error.message);
    console.error('🔧 Troubleshooting tips:');
    console.error('   1. Ensure PostgreSQL container is running.');
    console.error('   2. Verify pgvector/pgvector:pg16 Docker image is used.');
    console.error(
      '   3. Check database connection parameters in your .env file.'
    );
    console.error(
      '   4. Ensure the database user has CREATE EXTENSION privileges.'
    );
    throw error;
  } finally {
    client.release();
  }
}

async function checkCurrentSetup() {
  const client = await pool.connect();
  console.log('🔍 Checking current knowledge hub setup...');
  try {
    const tableExists = await client.query(
      "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'knowledge_entries');"
    );
    if (!tableExists.rows[0].exists) {
      console.log(
        'ℹ️ knowledge_entries table does not exist yet. Proceeding with setup.'
      );
      return false;
    }

    const columnInfo = await client.query(
      "SELECT data_type, udt_name FROM information_schema.columns WHERE table_name = 'knowledge_entries' AND column_name = 'embedding';"
    );

    // CORRECTED: All logic using columnInfo must be inside the try block.
    if (columnInfo.rows.length === 0) {
      console.log('ℹ️ No embedding column found. Proceeding with setup.');
      return false;
    }

    const embeddingCol = columnInfo.rows[0];
    console.log(`📊 Current embedding column type: ${embeddingCol.udt_name}`);
    if (embeddingCol.udt_name === 'vector') {
      console.log('✅ Already using pgvector type!');
      return true;
    } else {
      console.log(
        `⚠️  Currently using ${embeddingCol.udt_name}, should upgrade to vector type.`
      );
      return false;
    }
  } catch (error) {
    console.error('❌ Error checking setup:', error.message);
    return false;
  } finally {
    client.release();
  }
}

async function main() {
  try {
    console.log('🚀 Cartrita Knowledge Hub Vector Optimization');
    console.log('============================================\n');

    const isSetup = await checkCurrentSetup();
    if (isSetup) {
      console.log('\n✅ pgvector is already properly configured!');
      console.log(
        '🎯 Knowledge Hub is ready for high-performance vector operations.'
      );
    } else {
      console.log('\n⚡ Setting up pgvector for optimal performance...\n');
      await setupPgVector();
    }
  } catch (error) {
    console.error('\n❌ Main setup script failed.');
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run the main function
main();

export default { setupPgVector, checkCurrentSetup };
