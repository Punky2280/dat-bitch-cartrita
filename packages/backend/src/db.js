/* global process, console */
import { Pool  } from 'pg';

const pool = new Pool({
  user: process.env.POSTGRES_USER || 'robert',
  host: process.env.POSTGRES_HOST || 'db',
  database: process.env.POSTGRES_DB || 'dat-bitch-cartrita',
  password: process.env.POSTGRES_PASSWORD || 'punky1',
  port: process.env.POSTGRES_PORT || 5432
});

pool.on('connect', () => {
  console.log('✅ Database connected successfully');
});

pool.on('error', err => {
  console.error('❌ Database connection error:', err);
});

export default pool;
