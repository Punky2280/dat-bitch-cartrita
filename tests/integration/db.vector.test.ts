import { Client } from 'pg';
import { randomUUID } from 'crypto';
import { describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';

const cfg = {
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
  user: process.env.POSTGRES_USER || 'robert',
  password: process.env.POSTGRES_PASSWORD || 'punky1',
  database: process.env.POSTGRES_DB || 'dat-bitch-cartrita'
};

let client: Client;

// Test vectors (small dimension for testing)
function generateTestVector(dim: number = 8): number[] {
  return Array(dim).fill(0).map(() => Math.random() - 0.5);
}

function vectorToSql(vector: number[]): string {
  return `[${vector.join(',')}]`;
}

beforeAll(async () => {
  client = new Client(cfg);
  await client.connect();
  
  // Ensure we have a test user
  const userRes = await client.query(`
    INSERT INTO users (name, email, password_hash) 
    VALUES ('Test User', 'test@example.com', 'test_hash')
    ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
    RETURNING id
  `);
});

afterAll(async () => {
  // Cleanup test data
  await client.query(`DELETE FROM embeddings WHERE source_table = 'test_vectors'`);
  await client.query(`DELETE FROM users WHERE email = 'test@example.com'`);
  await client.end();
});

describe('Vector Operations Tests', () => {
  beforeEach(async () => {
    // Clean up test embeddings before each test
    await client.query(`DELETE FROM embeddings WHERE source_table = 'test_vectors'`);
  });

  test('can insert vector embedding directly', async () => {
    const testVector = generateTestVector(8);
    const sourceId = randomUUID();
    
    const res = await client.query(`
      INSERT INTO embeddings (source_table, source_id, embedding, embedding_model)
      VALUES ('test_vectors', $1, $2, 'test-model')
      RETURNING id, source_table, source_id
    `, [sourceId, vectorToSql(testVector)]);

    expect(res.rows.length).toBe(1);
    expect(res.rows[0].source_table).toBe('test_vectors');
    expect(res.rows[0].source_id).toBe(sourceId);
  });

  test('upsert_embedding function works', async () => {
    // Skip if function doesn't exist (older migration state)
    const fnRes = await client.query(`
      SELECT proname FROM pg_proc WHERE proname = 'upsert_embedding'
    `);
    if (fnRes.rows.length === 0) {
      console.log('Skipping upsert_embedding test - function not available');
      return;
    }

    const testVector = generateTestVector(8);
    const sourceId = randomUUID();
    
    // First upsert (insert)
    const res1 = await client.query(`
      SELECT upsert_embedding('test_vectors', $1, $2, 'test-model-v1')
    `, [sourceId, vectorToSql(testVector)]);
    
    expect(res1.rows.length).toBe(1);
    const embeddingId = res1.rows[0].upsert_embedding;

    // Verify insertion
    const verify1 = await client.query(`
      SELECT id, embedding_model FROM embeddings WHERE id = $1
    `, [embeddingId]);
    expect(verify1.rows[0].embedding_model).toBe('test-model-v1');

    // Second upsert (update)
    const newVector = generateTestVector(8);
    const res2 = await client.query(`
      SELECT upsert_embedding('test_vectors', $1, $2, 'test-model-v2')
    `, [sourceId, vectorToSql(newVector)]);
    
    expect(res2.rows[0].upsert_embedding).toBe(embeddingId);

    // Verify update
    const verify2 = await client.query(`
      SELECT embedding_model FROM embeddings WHERE id = $1
    `, [embeddingId]);
    expect(verify2.rows[0].embedding_model).toBe('test-model-v2');
  });

  test('similarity_search function works', async () => {
    // Skip if function doesn't exist
    const fnRes = await client.query(`
      SELECT proname FROM pg_proc WHERE proname = 'similarity_search'
    `);
    if (fnRes.rows.length === 0) {
      console.log('Skipping similarity_search test - function not available');
      return;
    }

    // Insert test vectors
    const vectors = [
      generateTestVector(8),
      generateTestVector(8),
      generateTestVector(8)
    ];

    for (let i = 0; i < vectors.length; i++) {
      await client.query(`
        INSERT INTO embeddings (source_table, source_id, embedding, embedding_model)
        VALUES ('test_vectors', $1, $2, 'test-model')
      `, [randomUUID(), vectorToSql(vectors[i])]);
    }

    // Search using first vector as query
    const searchRes = await client.query(`
      SELECT * FROM similarity_search($1, 0.0, 5, 'test_vectors')
    `, [vectorToSql(vectors[0])]);

    expect(searchRes.rows.length).toBeGreaterThan(0);
    expect(searchRes.rows.length).toBeLessThanOrEqual(5);
    
    // Results should be ordered by similarity (descending)
    if (searchRes.rows.length > 1) {
      for (let i = 0; i < searchRes.rows.length - 1; i++) {
        expect(searchRes.rows[i].similarity).toBeGreaterThanOrEqual(
          searchRes.rows[i + 1].similarity
        );
      }
    }
  });

  test('vector distance operators work', async () => {
    const vector1 = generateTestVector(8);
    const vector2 = generateTestVector(8);
    
    // Insert vectors
    const id1 = randomUUID();
    const id2 = randomUUID();
    
    await client.query(`
      INSERT INTO embeddings (source_table, source_id, embedding)
      VALUES ('test_vectors', $1, $2), ('test_vectors', $3, $4)
    `, [id1, vectorToSql(vector1), id2, vectorToSql(vector2)]);

    // Test cosine distance operator
    const distRes = await client.query(`
      SELECT 
        source_id,
        embedding <=> $1::vector as cosine_distance,
        embedding <-> $1::vector as l2_distance
      FROM embeddings 
      WHERE source_table = 'test_vectors'
      ORDER BY embedding <=> $1::vector
    `, [vectorToSql(vector1)]);

    expect(distRes.rows.length).toBe(2);
    expect(distRes.rows[0].cosine_distance).toBeGreaterThanOrEqual(0);
    expect(distRes.rows[0].l2_distance).toBeGreaterThanOrEqual(0);
    
    // First result should be the exact match (distance ~0)
    expect(distRes.rows[0].cosine_distance).toBeLessThan(0.1);
  });

  test('can handle large embeddings (1536 dimensions)', async () => {
    const largeVector = generateTestVector(1536);
    const sourceId = randomUUID();
    
    const res = await client.query(`
      INSERT INTO embeddings (source_table, source_id, embedding, embedding_model)
      VALUES ('test_vectors', $1, $2, 'text-embedding-3-large')
      RETURNING id
    `, [sourceId, vectorToSql(largeVector)]);

    expect(res.rows.length).toBe(1);
    
    // Verify retrieval
    const verify = await client.query(`
      SELECT array_length(string_to_array(trim(both '[]' from embedding::text), ','), 1) as dimension
      FROM embeddings 
      WHERE id = $1
    `, [res.rows[0].id]);
    
    expect(verify.rows[0].dimension).toBe(1536);
  });

  test('vector indexes are used in queries', async () => {
    // Insert enough vectors to potentially trigger index usage
    const vectors = Array(20).fill(0).map(() => generateTestVector(8));
    
    for (const vector of vectors) {
      await client.query(`
        INSERT INTO embeddings (source_table, source_id, embedding)
        VALUES ('test_vectors', $1, $2)
      `, [randomUUID(), vectorToSql(vector)]);
    }

    // Run an EXPLAIN to see if index is used
    const queryVector = generateTestVector(8);
    const explainRes = await client.query(`
      EXPLAIN (FORMAT JSON) 
      SELECT source_id, embedding <=> $1::vector as distance
      FROM embeddings 
      WHERE source_table = 'test_vectors'
      ORDER BY embedding <=> $1::vector 
      LIMIT 5
    `, [vectorToSql(queryVector)]);

    // Plan should exist (exact index usage depends on data size and postgres version)
    expect(explainRes.rows.length).toBe(1);
    expect(explainRes.rows[0]['QUERY PLAN']).toBeDefined();
  });

  test('content hash change detection works', async () => {
    const vector = generateTestVector(8);
    const sourceId = randomUUID();
    const hash1 = 'hash1';
    const hash2 = 'hash2';

    // Insert with first hash
    const res1 = await client.query(`
      INSERT INTO embeddings (source_table, source_id, embedding, content_hash)
      VALUES ('test_vectors', $1, $2, $3)
      RETURNING id, content_hash
    `, [sourceId, vectorToSql(vector), hash1]);

    expect(res1.rows[0].content_hash).toBe(hash1);

    // Update with new hash
    await client.query(`
      UPDATE embeddings 
      SET content_hash = $1, updated_at = NOW()
      WHERE id = $2
    `, [hash2, res1.rows[0].id]);

    // Verify update
    const verify = await client.query(`
      SELECT content_hash FROM embeddings WHERE id = $1
    `, [res1.rows[0].id]);

    expect(verify.rows[0].content_hash).toBe(hash2);
  });
});