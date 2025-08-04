import fs from 'fs';
import path from 'path';
import db from './src/db';

async function runMigration() {
  try {
    console.log('🚀 Running camera_enabled migration...');

    const migrationPath = path.join(__dirname, 'migrations', 'add_camera_enabled.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('📄 Executing migration SQL...');
    await db.query(migrationSQL);
    console.log('✅ Migration completed successfully!');

    // Test that the column was added
    const result = await db.query(`
      SELECT column_name, data_type, column_default 
      FROM information_schema.columns 
      WHERE table_name = 'user_settings' 
      AND column_name = 'camera_enabled'
    `);

    if (result.rows.length > 0) {
      console.log('🔍 Verified camera_enabled column:', result.rows[0]);
    } else {
      console.log('⚠️  camera_enabled column not found after migration');
    }
  } catch(error) {
    console.error('❌ Migration failed:', error);
  } finally {
    process.exit(0);
  }
}

runMigration()
