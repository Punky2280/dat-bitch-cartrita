/**
 * @fileoverview TestDatabase - Database utilities for integration testing
 * Provides database setup, cleanup, and data management for test isolation
 */

import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class TestDatabase {
  constructor() {
    this.pool = null;
    this.testDatabaseName = `cartrita_test_${Date.now()}`;
    this.initialized = false;
  }

  /**
   * Initialize test database with full schema
   */
  async initialize() {
    if (this.initialized) return;

    // Connect to default postgres database to create test database
    const adminPool = new Pool({
      host: process.env.TEST_DB_HOST || 'localhost',
      port: process.env.TEST_DB_PORT || 5432,
      database: 'postgres',
      user: process.env.TEST_DB_USER || 'postgres',
      password: process.env.TEST_DB_PASSWORD || 'postgres'
    });

    try {
      // Create test database
      await adminPool.query(`CREATE DATABASE "${this.testDatabaseName}"`);
      console.log(`✅ Created test database: ${this.testDatabaseName}`);
    } catch (error) {
      console.error('Failed to create test database:', error);
      throw error;
    } finally {
      await adminPool.end();
    }

    // Connect to test database
    this.pool = new Pool({
      host: process.env.TEST_DB_HOST || 'localhost',
      port: process.env.TEST_DB_PORT || 5432,
      database: this.testDatabaseName,
      user: process.env.TEST_DB_USER || 'postgres',
      password: process.env.TEST_DB_PASSWORD || 'postgres'
    });

    // Apply database schema
    await this.applySchema();
    this.initialized = true;
    console.log(`✅ Test database initialized: ${this.testDatabaseName}`);
  }

  /**
   * Apply database schema from migration files
   */
  async applySchema() {
    const dbInitDir = path.join(__dirname, '../../../db-init');
    
    // Core schema files in order
    const schemaFiles = [
      '00_setup_pgvector.sql',
      '06_comprehensive_cartrita_schema.sql'
    ];

    for (const fileName of schemaFiles) {
      const filePath = path.join(dbInitDir, fileName);
      if (fs.existsSync(filePath)) {
        const sql = fs.readFileSync(filePath, 'utf8');
        
        // Split by semicolon and execute each statement
        const statements = sql.split(';').filter(stmt => stmt.trim());
        
        for (const statement of statements) {
          if (statement.trim()) {
            try {
              await this.pool.query(statement);
            } catch (error) {
              console.warn(`Warning executing schema statement: ${error.message}`);
            }
          }
        }
        console.log(`✅ Applied schema: ${fileName}`);
      }
    }
  }

  /**
   * Get database pool for queries
   */
  getPool() {
    if (!this.pool) {
      throw new Error('TestDatabase not initialized. Call initialize() first.');
    }
    return this.pool;
  }

  /**
   * Execute query with parameters
   */
  async query(text, params) {
    const pool = this.getPool();
    return await pool.query(text, params);
  }

  /**
   * Create test user with authentication
   */
  async createTestUser(userData = {}) {
    const defaultUser = {
      name: 'Test User',
      email: `test${Date.now()}@example.com`,
      password_hash: '$2b$10$test.hash.for.testing.purposes',
      created_at: new Date(),
      updated_at: new Date()
    };

    const user = { ...defaultUser, ...userData };

    const result = await this.query(
      `INSERT INTO users (name, email, password_hash, created_at, updated_at) 
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [user.name, user.email, user.password_hash, user.created_at, user.updated_at]
    );

    return result.rows[0];
  }

  /**
   * Create test conversation
   */
  async createTestConversation(userId, conversationData = {}) {
    const defaultConversation = {
      title: 'Test Conversation',
      created_at: new Date(),
      updated_at: new Date()
    };

    const conversation = { ...defaultConversation, ...conversationData };

    const result = await this.query(
      `INSERT INTO conversations (user_id, title, created_at, updated_at) 
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [userId, conversation.title, conversation.created_at, conversation.updated_at]
    );

    return result.rows[0];
  }

  /**
   * Create test message
   */
  async createTestMessage(conversationId, messageData = {}) {
    const defaultMessage = {
      role: 'user',
      content: 'Test message content',
      created_at: new Date()
    };

    const message = { ...defaultMessage, ...messageData };

    const result = await this.query(
      `INSERT INTO conversation_messages (conversation_id, role, content, created_at) 
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [conversationId, message.role, message.content, message.created_at]
    );

    return result.rows[0];
  }

  /**
   * Create test API key vault entry
   */
  async createTestVaultEntry(userId, vaultData = {}) {
    const defaultVaultData = {
      provider: 'openai',
      key_name: 'test-key',
      encrypted_value: 'encrypted-test-value',
      is_active: true,
      created_at: new Date(),
      updated_at: new Date()
    };

    const vault = { ...defaultVaultData, ...vaultData };

    const result = await this.query(
      `INSERT INTO api_key_vault (user_id, provider, key_name, encrypted_value, is_active, created_at, updated_at) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [vault.user_id || userId, vault.provider, vault.key_name, vault.encrypted_value, 
       vault.is_active, vault.created_at, vault.updated_at]
    );

    return result.rows[0];
  }

  /**
   * Create test workflow
   */
  async createTestWorkflow(userId, workflowData = {}) {
    const defaultWorkflow = {
      name: 'Test Workflow',
      description: 'A test workflow',
      definition: JSON.stringify({
        nodes: [{
          id: 'start',
          type: 'trigger',
          position: { x: 0, y: 0 }
        }]
      }),
      is_active: true,
      created_at: new Date(),
      updated_at: new Date()
    };

    const workflow = { ...defaultWorkflow, ...workflowData };

    const result = await this.query(
      `INSERT INTO workflows (user_id, name, description, definition, is_active, created_at, updated_at) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [userId, workflow.name, workflow.description, workflow.definition, 
       workflow.is_active, workflow.created_at, workflow.updated_at]
    );

    return result.rows[0];
  }

  /**
   * Clear all test data
   */
  async clearData() {
    const tables = [
      'conversation_messages',
      'conversations', 
      'workflows',
      'workflow_executions',
      'api_key_vault',
      'users',
      'user_settings'
    ];

    for (const table of tables) {
      try {
        await this.query(`TRUNCATE ${table} RESTART IDENTITY CASCADE`);
      } catch (error) {
        // Table might not exist in test schema
        console.warn(`Warning clearing table ${table}: ${error.message}`);
      }
    }

    console.log('✅ Cleared all test data');
  }

  /**
   * Get table row count
   */
  async getTableCount(tableName) {
    const result = await this.query(`SELECT COUNT(*) as count FROM ${tableName}`);
    return parseInt(result.rows[0].count);
  }

  /**
   * Cleanup test database
   */
  async cleanup() {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }

    // Connect to default postgres database to drop test database
    const adminPool = new Pool({
      host: process.env.TEST_DB_HOST || 'localhost',
      port: process.env.TEST_DB_PORT || 5432,
      database: 'postgres',
      user: process.env.TEST_DB_USER || 'postgres',
      password: process.env.TEST_DB_PASSWORD || 'postgres'
    });

    try {
      // Terminate connections to test database
      await adminPool.query(`
        SELECT pg_terminate_backend(pid) 
        FROM pg_stat_activity 
        WHERE datname = $1 AND pid <> pg_backend_pid()
      `, [this.testDatabaseName]);

      // Drop test database
      await adminPool.query(`DROP DATABASE IF EXISTS "${this.testDatabaseName}"`);
      console.log(`✅ Cleaned up test database: ${this.testDatabaseName}`);
    } catch (error) {
      console.error('Failed to cleanup test database:', error);
    } finally {
      await adminPool.end();
    }

    this.initialized = false;
  }

  /**
   * Execute transaction with rollback support
   */
  async withTransaction(callback) {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Seed test data for comprehensive testing
   */
  async seedTestData() {
    // Create test users
    const user1 = await this.createTestUser({
      name: 'John Doe',
      email: 'john@test.com'
    });

    const user2 = await this.createTestUser({
      name: 'Jane Smith', 
      email: 'jane@test.com'
    });

    // Create test conversations
    const conversation1 = await this.createTestConversation(user1.id, {
      title: 'AI Development Discussion'
    });

    const conversation2 = await this.createTestConversation(user2.id, {
      title: 'Workflow Automation'
    });

    // Create test messages
    await this.createTestMessage(conversation1.id, {
      role: 'user',
      content: 'How do I implement multi-agent systems?'
    });

    await this.createTestMessage(conversation1.id, {
      role: 'assistant', 
      content: 'Multi-agent systems require careful orchestration...'
    });

    // Create test workflows
    await this.createTestWorkflow(user1.id, {
      name: 'Email Processing Workflow',
      description: 'Automatically process and categorize emails'
    });

    // Create test vault entries
    await this.createTestVaultEntry(user1.id, {
      provider: 'openai',
      key_name: 'main-api-key'
    });

    await this.createTestVaultEntry(user2.id, {
      provider: 'deepgram',
      key_name: 'speech-key'
    });

    console.log('✅ Seeded test data');
    return { user1, user2, conversation1, conversation2 };
  }
}

export default TestDatabase;
