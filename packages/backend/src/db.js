/* global process, console */
import { Pool } from 'pg';

const baseConfig = {
  user: process.env.POSTGRES_USER || 'robert',
  host: process.env.POSTGRES_HOST || 'db',
  database: process.env.POSTGRES_DB || 'dat-bitch-cartrita',
  password: process.env.POSTGRES_PASSWORD || 'punky1',
  port: Number(process.env.POSTGRES_PORT) || 5432,
};

async function selectConfig() {
  // Try primary first
  let testPool = new Pool(baseConfig);
  try {
    await testPool.query('SELECT 1');
    testPool.end();
  console.log('[db] ✅ Primary database reachable');
    return baseConfig;
  } catch (err) {
    // Fallback only for local dev host to mapped port 5435 (or if autofallback flag enabled)
    if (
      (process.env.DB_PORT_AUTOFALLBACK === '1' || !process.env.POSTGRES_PORT) &&
      (baseConfig.host === 'localhost' || baseConfig.host === '127.0.0.1') &&
      baseConfig.port === 5432
    ) {
      console.warn('[db] Primary port 5432 failed, attempting fallback port 5435');
      const fallback = { ...baseConfig, port: 5435 };
      testPool = new Pool(fallback);
      try {
        await testPool.query('SELECT 1');
        testPool.end();
        console.log('[db] ✅ Connected via fallback port 5435');
        return fallback;
      } catch (fallbackErr) {
        console.error('[db] ❌ Fallback port 5435 also failed:', fallbackErr.message);
        return baseConfig; // return primary anyway; downstream errors will surface
      }
    }
  console.error('[db] ❌ Primary database unreachable and no fallback criteria met:', err.message);
    return baseConfig;
  }
}

const finalConfig = await selectConfig();
const pool = new Pool(finalConfig);

pool.on('connect', () => {
  console.log(`✅ Database connected (${finalConfig.host}:${finalConfig.port})`);
});

pool.on('error', err => {
  console.error('❌ Database connection error:', err.message || err);
});

export default pool;
