import db from '../db.js';

class DatabaseService {
  static async query(text, params) {
    return await db.query(text, params);
  }

  static async transaction(callback) {
    const client = await db.connect();
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

  static async healthCheck() {
    try {
      const result = await db.query('SELECT NOW()');
      return { status: 'healthy', timestamp: result.rows[0].now };
    } catch (error) {
      return { status: 'unhealthy', error: error.message };
    }
  }
}

export default DatabaseService;