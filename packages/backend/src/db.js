/* global process, console */
import { Pool } from 'pg';

const baseConfig = {
  user: process.env.POSTGRES_USER || 'robert',
  host: process.env.POSTGRES_HOST || 'localhost',
  database: process.env.POSTGRES_DB || 'dat-bitch-cartrita',
  password: process.env.POSTGRES_PASSWORD || 'punky1',
  port: Number(process.env.POSTGRES_PORT) || 5435,
};

let pool;
if (process.env.DB_SKIP === '1' || process.env.NODE_ENV === 'test') {
  // Lightweight stub for tests / migrations skipped runs
  pool = {
    query: async () => ({ rows: [], rowCount: 0 }),
    end: async () => {},
    on: () => {},
  };
} else {
  // Create pool immediately with base config (non-blocking)
  pool = new Pool(baseConfig);
  pool.on('connect', () => {
    console.log(`✅ Database connected (${baseConfig.host}:${baseConfig.port})`);
  });
  pool.on('error', err => {
    console.error('❌ Database connection error:', err.message || err);
  });
  // Async health check + optional port fallback (non-blocking, no top-level await)
  (async () => {
    try {
      await pool.query('SELECT 1');
      console.log('[db] ✅ Primary database reachable');
    } catch (err) {
      if (
        (process.env.DB_PORT_AUTOFALLBACK === '1' || !process.env.POSTGRES_PORT) &&
        (baseConfig.host === 'localhost' || baseConfig.host === '127.0.0.1') &&
        baseConfig.port === 5432
      ) {
        try {
          console.warn('[db] Primary port 5432 failed, attempting fallback port 5435');
          const fallback = { ...baseConfig, port: 5435 };
          const fallbackPool = new Pool(fallback);
          await fallbackPool.query('SELECT 1');
          pool.end().catch(()=>{});
          pool = fallbackPool;
          console.log('[db] ✅ Connected via fallback port 5435');
        } catch (fallbackErr) {
          console.error('[db] ❌ Fallback port 5435 also failed:', fallbackErr.message);
        }
      } else {
        console.error('[db] ❌ Primary database unreachable (continuing):', err.message);
      }
    }
  })();
}

export default pool;
