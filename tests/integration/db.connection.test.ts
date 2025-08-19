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

describe('Database Connection Tests', () => {
  test('connects to postgres successfully', async () => {
    const res = await client.query('SELECT 1 as connection_test');
    expect(res.rows[0].connection_test).toBe(1);
  });

  test('database has correct name', async () => {
    const res = await client.query('SELECT current_database()');
    expect(res.rows[0].current_database).toBe(cfg.database);
  });

  test('user has correct permissions', async () => {
    const res = await client.query('SELECT current_user');
    expect(res.rows[0].current_user).toBe(cfg.user);
  });

  test('can create and drop test table', async () => {
    // Create test table
    await client.query(`
      CREATE TABLE IF NOT EXISTS connection_test (
        id SERIAL PRIMARY KEY,
        test_data TEXT
      )
    `);

    // Insert test data
    await client.query('INSERT INTO connection_test (test_data) VALUES ($1)', ['test']);

    // Verify data
    const res = await client.query('SELECT test_data FROM connection_test WHERE test_data = $1', ['test']);
    expect(res.rows.length).toBe(1);
    expect(res.rows[0].test_data).toBe('test');

    // Cleanup
    await client.query('DROP TABLE connection_test');
  });

  test('postgres version is compatible', async () => {
    const res = await client.query('SELECT version()');
    const version = res.rows[0].version;
    expect(version).toMatch(/PostgreSQL (1[3-9]|[2-9]\d)/); // Postgres 13+
  });
});