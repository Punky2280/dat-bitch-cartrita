const express = require('express');
const { Pool } = require('pg');
const app = express();
const port = 8000;

// Database connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

app.get('/', (req, res) => {
  res.send('Cartrita Backend is alive!');
});

// Add a new route to test the database connection
app.get('/db-test', async (req, res) => {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    res.json({
      message: 'Database connection successful!',
      time: result.rows[0].now,
    });
    client.release();
  } catch (err) {
    console.error('Database connection error', err.stack);
    res.status(500).json({
      error: 'Failed to connect to the database.',
      details: err.message,
    });
  }
});

app.listen(port, () => {
  console.log(`Cartrita backend listening at http://localhost:${port}`);
  console.log('To test DB connection, visit http://localhost:8000/db-test');
});
