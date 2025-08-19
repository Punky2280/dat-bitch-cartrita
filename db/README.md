# Database Migrations - v1 to v2 Transition

## Overview
This directory contains versioned database migrations for the Cartrita v1 -> v2 transition, implementing:
- pgvector extension and enhanced vector search capabilities
- Redis integration and session management
- Hybrid vector/keyword search
- Performance optimizations and advanced indexing

## Migration Files
- `0001_initial_baseline.sql` - Establishes migration tracking baseline
- `0002_add_vector_extension.sql` - Adds pgvector and enhanced embedding tables
- `0003_optimize_vector_indexes.sql` - Optimizes vector search with HNSW/IVFFlat indexing
- `0004_add_redis_hybrid_search.sql` - Adds Redis integration and hybrid search

## Usage

### Local Development
```bash
# Install dependencies
npm install pg tsx

# Run migrations (with existing .env)
npm run db:migrate

# Force migration (skip checksum validation)
FORCE_MIGRATION=true npm run db:migrate

# Verify migration status
psql $DATABASE_URL -c "SELECT version, applied_at, description FROM schema_migrations ORDER BY applied_at;"
```

### Kubernetes/Production
```bash
# Create secrets from existing .env
kubectl -n data-stack create secret generic postgres-secret \
  --from-literal=POSTGRES_USER=$(grep POSTGRES_USER .env | cut -d= -f2) \
  --from-literal=POSTGRES_PASSWORD=$(grep POSTGRES_PASSWORD .env | cut -d= -f2) \
  --from-literal=POSTGRES_DB=$(grep POSTGRES_DB .env | cut -d= -f2)

# Run migrations via port-forward
kubectl -n data-stack port-forward svc/postgres 55432:5432 &
POSTGRES_HOST=localhost POSTGRES_PORT=55432 npm run db:migrate

# Or use Job runner (see k8s/job-db-migrate.yaml)
kubectl apply -f k8s/job-db-migrate.yaml
```

## Migration Features

### Enhanced Vector Search
- Unified `embeddings` table for all vector data
- Support for multiple embedding models
- Content change detection via SHA256 hashing
- Automatic HNSW/IVFFlat index selection based on data size

### Hybrid Search
- Combines vector similarity and full-text search
- Configurable weighting (default: 70% vector, 30% keyword)
- User-specific retrieval configurations
- Performance metrics tracking

### Functions Added
- `upsert_embedding()` - Intelligent embedding insertion/updates
- `similarity_search()` - Pure vector search
- `hybrid_search()` - Combined vector + keyword search
- `rebuild_vector_indexes()` - Index maintenance utility

### Monitoring
- `vector_search_stats` view - Embedding statistics by source
- Performance metrics table - Query execution tracking
- Cache invalidation logging

## Rollback Strategy
1. Stop application traffic to v2
2. Restore from pre-migration backup:
   ```bash
   pg_restore -h $POSTGRES_HOST -U $POSTGRES_USER -d $POSTGRES_DB backups/pre_migration.dump --clean
   ```
3. Point application back to v1 configuration
4. Investigate and fix migration issues

## Performance Notes
- Vector indexes are created conditionally (>1000 rows for IVFFlat, >1000 for HNSW)
- Use `ANALYZE embeddings` after bulk inserts
- Monitor query performance via `search_performance_metrics` table
- Consider VACUUM FULL on embeddings table after large migrations

## Troubleshooting

### pgvector Not Available
```sql
-- Check extension availability
SELECT name FROM pg_available_extensions WHERE name = 'vector';

-- Install if available
CREATE EXTENSION vector;
```

### Index Build Failures
```sql
-- Rebuild indexes
SELECT rebuild_vector_indexes();

-- Check index status
SELECT schemaname, tablename, indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'embeddings';
```

### Migration Stuck
```sql
-- Check locks
SELECT pid, query, state, waiting FROM pg_stat_activity 
WHERE state != 'idle' AND query LIKE '%embeddings%';

-- Kill blocking queries if needed
SELECT pg_terminate_backend(pid) FROM pg_stat_activity 
WHERE state = 'idle in transaction' AND query_start < NOW() - interval '5 minutes';
```