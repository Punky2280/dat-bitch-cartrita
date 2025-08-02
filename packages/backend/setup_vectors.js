#!/usr/bin/env node

/**
 * PostgreSQL Vector Extension Setup Script
 * 
 * This script sets up pgvector extension and creates optimized
 * knowledge hub tables with proper vector column types and indexes.
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config();

// Database configuration
const pool = new Pool({
  user: process.env.POSTGRES_USER || 'robert',
  host: 'localhost', 
  database: process.env.POSTGRES_DB || 'dat-bitch-cartrita',
  password: process.env.POSTGRES_PASSWORD || 'punky1',
  port: 5434, // Use the exposed Docker port
});

async function setupPgVector() {
  const client = await pool.connect();
  
  try {
    console.log('🚀 Starting pgvector setup...');
    
    // Read the setup SQL file
    const setupSQL = fs.readFileSync(
      path.join(__dirname, 'setup_pgvector.sql'), 
      'utf8'
    );
    
    console.log('📄 Executing pgvector setup SQL...');
    
    // Execute the setup SQL
    await client.query(setupSQL);
    
    console.log('✅ pgvector extension installed successfully!');
    
    // Verify the setup
    console.log('🔍 Verifying installation...');
    
    // Check if extension is installed
    const extensionCheck = await client.query(`
      SELECT EXISTS(
        SELECT 1 FROM pg_extension WHERE extname = 'vector'
      ) as vector_installed;
    `);
    
    if (extensionCheck.rows[0].vector_installed) {
      console.log('✅ pgvector extension is active');
    } else {
      throw new Error('❌ pgvector extension not found');
    }
    
    // Check if knowledge_entries table exists with vector column
    const tableCheck = await client.query(`
      SELECT 
        column_name, 
        data_type,
        udt_name
      FROM information_schema.columns 
      WHERE table_name = 'knowledge_entries' 
        AND column_name = 'embedding';
    `);
    
    if (tableCheck.rows.length > 0) {
      const embeddingColumn = tableCheck.rows[0];
      console.log(`✅ knowledge_entries.embedding column: ${embeddingColumn.udt_name}`);
    } else {
      console.log('⚠️  knowledge_entries.embedding column not found');
    }
    
    // Check vector indexes
    const indexCheck = await client.query(`
      SELECT 
        indexname,
        indexdef
      FROM pg_indexes 
      WHERE tablename = 'knowledge_entries' 
        AND indexname LIKE '%embedding%';
    `);
    
    console.log(`✅ Vector indexes created: ${indexCheck.rows.length}`);
    indexCheck.rows.forEach(idx => {
      console.log(`   - ${idx.indexname}`);
    });
    
    // Test vector operations
    console.log('🧪 Testing vector operations...');
    
    const vectorTest = await client.query(`
      SELECT vector_similarity(
        '[1,0,0]'::vector, 
        '[0,1,0]'::vector,
        'cosine'
      ) as similarity;
    `);
    
    console.log(`✅ Vector similarity test: ${vectorTest.rows[0].similarity}`);
    
    // Check database statistics
    const stats = await client.query(`
      SELECT 
        schemaname,
        tablename,
        n_tup_ins as inserts,
        n_tup_upd as updates,
        n_tup_del as deletes
      FROM pg_stat_user_tables 
      WHERE tablename IN ('knowledge_entries', 'knowledge_clusters', 'memory_sessions');
    `);
    
    console.log('📊 Table statistics:');
    stats.rows.forEach(stat => {
      console.log(`   ${stat.tablename}: ${stat.inserts} inserts, ${stat.updates} updates`);
    });
    
    console.log('\n🎉 pgvector setup completed successfully!');
    console.log('📚 Knowledge Hub is now optimized with vector similarity search');
    console.log('🔍 Semantic search performance significantly improved');
    console.log('📈 Advanced clustering and analytics ready');
    
  } catch (error) {
    console.error('❌ Error setting up pgvector:', error.message);
    console.error('🔧 Troubleshooting tips:');
    console.error('   1. Ensure PostgreSQL container is running');
    console.error('   2. Verify pgvector/pgvector:pg16 Docker image is used');
    console.error('   3. Check database connection parameters');
    console.error('   4. Ensure database user has CREATE EXTENSION privileges');
    throw error;
  } finally {
    client.release();
  }
}

async function checkCurrentSetup() {
  const client = await pool.connect();
  
  try {
    console.log('🔍 Checking current knowledge hub setup...');
    
    // Check if knowledge_entries table exists
    const tableExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'knowledge_entries'
      );
    `);
    
    if (!tableExists.rows[0].exists) {
      console.log('ℹ️  knowledge_entries table does not exist yet');
      return false;
    }
    
    // Check current embedding column type
    const columnInfo = await client.query(`
      SELECT 
        column_name,
        data_type,
        udt_name,
        character_maximum_length
      FROM information_schema.columns 
      WHERE table_name = 'knowledge_entries' 
        AND column_name = 'embedding';
    `);
    
    if (columnInfo.rows.length === 0) {
      console.log('ℹ️  No embedding column found');
      return false;
    }
    
    const embeddingCol = columnInfo.rows[0];
    console.log(`📊 Current embedding column: ${embeddingCol.data_type} (${embeddingCol.udt_name})`);
    
    if (embeddingCol.udt_name === 'vector') {
      console.log('✅ Already using pgvector type!');
      return true;
    } else {
      console.log(`⚠️  Currently using ${embeddingCol.udt_name}, should upgrade to vector type`);
      return false;
    }
    
  } catch (error) {
    console.error('❌ Error checking setup:', error.message);
    return false;
  } finally {
    client.release();
  }
}

// Main execution
async function main() {
  try {
    console.log('🚀 Cartrita Knowledge Hub Vector Optimization');
    console.log('============================================\n');
    
    const isSetup = await checkCurrentSetup();
    
    if (isSetup) {
      console.log('✅ pgvector is already properly configured!');
      console.log('🎯 Knowledge Hub is ready for high-performance vector operations');
    } else {
      console.log('⚡ Setting up pgvector for optimal performance...\n');
      await setupPgVector();
    }
    
  } catch (error) {
    console.error('\n❌ Setup failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run the setup
if (require.main === module) {
  main();
}

module.exports = { setupPgVector, checkCurrentSetup };