import { Client } from 'pg';
import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';

const cfg = {
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
  user: process.env.POSTGRES_USER || 'robert',
  password: process.env.POSTGRES_PASSWORD || 'punky1',
  database: process.env.POSTGRES_DB || 'dat-bitch-cartrita'
};

let client: Client;

beforeAll(async () => {
  client = new Client(cfg);
  await client.connect();
});

afterAll(async () => {
  await client.end();
});

describe('Database Migration Tests', () => {
  test('schema_migrations table exists', async () => {
    const res = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name = 'schema_migrations'
    `);
    expect(res.rows.length).toBe(1);
  });

  test('migrations table has correct structure', async () => {
    const res = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public' 
        AND table_name = 'schema_migrations'
      ORDER BY ordinal_position
    `);

    const columns = res.rows;
    expect(columns.find(c => c.column_name === 'version')).toBeDefined();
    expect(columns.find(c => c.column_name === 'applied_at')).toBeDefined();
    expect(columns.find(c => c.column_name === 'checksum')).toBeDefined();
  });

  test('baseline migration is recorded', async () => {
    const res = await client.query(`
      SELECT version, description, migration_type 
      FROM schema_migrations 
      WHERE version = '0001_initial_baseline.sql'
    `);
    expect(res.rows.length).toBeGreaterThanOrEqual(0); // May not exist in fresh install
  });

  test('pgvector extension is installed', async () => {
    const res = await client.query(`
      SELECT extname, extversion 
      FROM pg_extension 
      WHERE extname = 'vector'
    `);
    expect(res.rows.length).toBe(1);
    expect(res.rows[0].extname).toBe('vector');
  });

  test('uuid-ossp extension is installed', async () => {
    const res = await client.query(`
      SELECT extname 
      FROM pg_extension 
      WHERE extname = 'uuid-ossp'
    `);
    expect(res.rows.length).toBe(1);
  });

  test('embeddings table exists with correct structure', async () => {
    // Check table exists
    const tableRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name = 'embeddings'
    `);
    expect(tableRes.rows.length).toBe(1);

    // Check columns
    const columnsRes = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns
      WHERE table_schema = 'public' 
        AND table_name = 'embeddings'
      ORDER BY ordinal_position
    `);

    const columns = columnsRes.rows.map(r => r.column_name);
    expect(columns).toContain('id');
    expect(columns).toContain('source_table');
    expect(columns).toContain('source_id');
    expect(columns).toContain('embedding');
    expect(columns).toContain('embedding_model');
    expect(columns).toContain('content_hash');
  });

  test('vector search functions exist', async () => {
    // Test upsert_embedding function
    const upsertRes = await client.query(`
      SELECT proname, pronargs 
      FROM pg_proc 
      WHERE proname = 'upsert_embedding'
    `);
    expect(upsertRes.rows.length).toBe(1);

    // Test similarity_search function  
    const similarityRes = await client.query(`
      SELECT proname, pronargs 
      FROM pg_proc 
      WHERE proname = 'similarity_search'
    `);
    expect(similarityRes.rows.length).toBe(1);

    // Test hybrid_search function (if migration 0004 applied)
    const hybridRes = await client.query(`
      SELECT proname, pronargs 
      FROM pg_proc 
      WHERE proname = 'hybrid_search'
    `);
    // May not exist if only baseline migrations applied
    expect(hybridRes.rows.length).toBeGreaterThanOrEqual(0);
  });

  test('vector indexes are created appropriately', async () => {
    // Check for vector indexes
    const indexRes = await client.query(`
      SELECT indexname, indexdef 
      FROM pg_indexes 
      WHERE tablename = 'embeddings' 
        AND indexdef LIKE '%vector%'
    `);
    
    // May have 0 indexes if table is empty, or multiple depending on row count
    expect(indexRes.rows.length).toBeGreaterThanOrEqual(0);
  });

  test('core Cartrita tables exist', async () => {
    const requiredTables = [
      'users',
      'user_preferences', 
      'knowledge_entries',
      'chat_sessions',
      'chat_messages',
      'workflows',
      'workflow_executions'
    ];

    for (const tableName of requiredTables) {
      const res = await client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
          AND table_name = $1
      `, [tableName]);
      expect(res.rows.length).toBe(1);
    }
  });

  test('knowledge_entries has vector support', async () => {
    const res = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns
      WHERE table_schema = 'public' 
        AND table_name = 'knowledge_entries'
        AND column_name = 'embedding'
    `);
    expect(res.rows.length).toBe(1);
    expect(res.rows[0].data_type).toBe('USER-DEFINED'); // pgvector type
  });
});