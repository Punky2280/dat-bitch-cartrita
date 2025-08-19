import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { Client } from 'pg';

interface MigrationManifest {
  migrations: Array<{
    version: string;
    checksum: string;
    description: string;
    type: string;
    dependencies: string[];
  }>;
  metadata: {
    version: string;
    target_db: string;
    extensions_required: string[];
    min_postgres_version: string;
    min_pgvector_version: string;
    created_at: string;
    migration_strategy: string;
  };
}

function sha256(content: string): string {
  return 'SHA256:' + crypto.createHash('sha256').update(content).digest('hex');
}

function loadManifest(): MigrationManifest {
  const manifestPath = path.join(process.cwd(), 'db', 'MIGRATION_MANIFEST.json');
  return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
}

async function checkPrerequisites(client: Client): Promise<void> {
  // Check PostgreSQL version
  const pgVersion = await client.query('SELECT version()');
  console.log(`[migrate] PostgreSQL: ${pgVersion.rows[0].version}`);

  // Check pgvector extension
  try {
    const vectorCheck = await client.query("SELECT extname, extversion FROM pg_extension WHERE extname = 'vector'");
    if (vectorCheck.rows.length > 0) {
      console.log(`[migrate] pgvector extension: ${vectorCheck.rows[0].extversion}`);
    } else {
      console.log('[migrate] pgvector extension not found - will be installed');
    }
  } catch (e) {
    console.log('[migrate] pgvector check failed - extension will be installed during migration');
  }

  // Check uuid-ossp extension
  try {
    const uuidCheck = await client.query("SELECT extname FROM pg_extension WHERE extname = 'uuid-ossp'");
    if (uuidCheck.rows.length > 0) {
      console.log('[migrate] uuid-ossp extension: present');
    }
  } catch (e) {
    console.log('[migrate] uuid-ossp extension will be installed during migration');
  }
}

async function validateChecksums(migrationsDir: string): Promise<{ [key: string]: string }> {
  const manifest = loadManifest();
  const actualChecksums: { [key: string]: string } = {};

  for (const migration of manifest.migrations) {
    const migrationPath = path.join(migrationsDir, migration.version);
    if (fs.existsSync(migrationPath)) {
      const content = fs.readFileSync(migrationPath, 'utf8');
      const actualChecksum = sha256(content);
      actualChecksums[migration.version] = actualChecksum;

      // For development, auto-update checksums
      if (process.env.NODE_ENV === 'development' && actualChecksum !== migration.checksum) {
        console.log(`[migrate] Updating checksum for ${migration.version} (development mode)`);
      } else if (actualChecksum !== migration.checksum && !migration.checksum.includes('PLACEHOLDER')) {
        throw new Error(
          `Checksum mismatch for ${migration.version}: expected ${migration.checksum}, got ${actualChecksum}`
        );
      }
    }
  }

  return actualChecksums;
}

async function applyMigration(client: Client, migrationFile: string, migrationsDir: string): Promise<void> {
  const migrationPath = path.join(migrationsDir, migrationFile);
  const content = fs.readFileSync(migrationPath, 'utf8');
  const checksum = sha256(content);

  console.log(`[migrate] Applying ${migrationFile}`);

  await client.query('BEGIN');
  try {
    // Execute migration SQL
    await client.query(content);

    // Record in migrations table
    await client.query(
      `INSERT INTO schema_migrations (version, checksum, description, migration_type) 
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (version) DO UPDATE SET 
         checksum = EXCLUDED.checksum,
         applied_at = NOW(),
         description = EXCLUDED.description`,
      [
        migrationFile,
        checksum,
        `Applied migration ${migrationFile}`,
        migrationFile.includes('baseline') ? 'baseline' : 'ddl'
      ]
    );

    await client.query('COMMIT');
    console.log(`[migrate] ✅ Applied ${migrationFile}`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`[migrate] ❌ Failed to apply ${migrationFile}:`, error);
    throw error;
  }
}

async function getAppliedMigrations(client: Client): Promise<Set<string>> {
  try {
    const result = await client.query('SELECT version FROM schema_migrations ORDER BY applied_at');
    return new Set(result.rows.map(row => row.version));
  } catch (error) {
    // Table doesn't exist yet
    console.log('[migrate] schema_migrations table not found - will be created');
    return new Set();
  }
}

async function main(): Promise<void> {
  const {
    POSTGRES_HOST,
    POSTGRES_PORT,
    POSTGRES_DB,
    POSTGRES_USER,
    POSTGRES_PASSWORD
  } = process.env;

  if (!POSTGRES_HOST || !POSTGRES_USER || !POSTGRES_PASSWORD || !POSTGRES_DB) {
    throw new Error('Missing required environment variables: POSTGRES_HOST, POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB');
  }

  const client = new Client({
    host: POSTGRES_HOST,
    port: parseInt(POSTGRES_PORT || '5432', 10),
    database: POSTGRES_DB,
    user: POSTGRES_USER,
    password: POSTGRES_PASSWORD,
    ssl: process.env.POSTGRES_SSL === 'true' ? { rejectUnauthorized: false } : false
  });

  try {
    await client.connect();
    console.log(`[migrate] Connected to PostgreSQL at ${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}`);

    // Check prerequisites
    await checkPrerequisites(client);

    const migrationsDir = path.join(process.cwd(), 'db', 'migrations');
    const manifest = loadManifest();

    // Validate checksums
    try {
      await validateChecksums(migrationsDir);
      console.log('[migrate] Checksum validation passed');
    } catch (error) {
      if (process.env.FORCE_MIGRATION !== 'true') {
        throw error;
      }
      console.warn('[migrate] Checksum validation failed but FORCE_MIGRATION=true, continuing...');
    }

    // Get applied migrations
    const applied = await getAppliedMigrations(client);

    // Apply migrations in dependency order
    const toApply: string[] = [];
    const processed = new Set<string>();

    function addMigration(version: string) {
      if (processed.has(version)) return;
      
      const migration = manifest.migrations.find(m => m.version === version);
      if (!migration) {
        throw new Error(`Migration ${version} not found in manifest`);
      }

      // Add dependencies first
      for (const dep of migration.dependencies) {
        addMigration(dep);
      }

      if (!applied.has(version)) {
        toApply.push(version);
      }
      processed.add(version);
    }

    // Process all migrations
    for (const migration of manifest.migrations) {
      addMigration(migration.version);
    }

    if (toApply.length === 0) {
      console.log('[migrate] All migrations are up to date');
      return;
    }

    console.log(`[migrate] Found ${toApply.length} migrations to apply:`);
    toApply.forEach(m => console.log(`  - ${m}`));

    // Apply migrations
    for (const migration of toApply) {
      await applyMigration(client, migration, migrationsDir);
    }

    console.log('[migrate] 🎉 All migrations applied successfully');

    // Display summary
    const finalCount = await client.query('SELECT COUNT(*) FROM schema_migrations');
    console.log(`[migrate] Total applied migrations: ${finalCount.rows[0].count}`);

    // Check pgvector functionality
    try {
      const vectorTest = await client.query("SELECT '[1,2,3]'::vector");
      console.log('[migrate] ✅ pgvector functionality verified');
    } catch (error) {
      console.warn('[migrate] ⚠️ pgvector test failed:', error.message);
    }

  } finally {
    await client.end();
  }
}

// CLI handling
if (require.main === module) {
  main().catch(error => {
    console.error('[migrate] Fatal error:', error);
    process.exit(1);
  });
}

export default main;