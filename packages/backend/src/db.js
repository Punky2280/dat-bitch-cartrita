const { Pool } = require('pg');

// This will use the DATABASE_URL from the .env file loaded in index.js
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

module.exports = pool;