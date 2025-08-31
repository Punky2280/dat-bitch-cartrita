# Cartrita v1 → v2 Migration Guide

## Overview

This guide provides a complete, production-ready migration path from Cartrita v1 (Docker Compose) to v2 (Kubernetes with pgvector) while preserving all existing data and credentials.

## Architecture Changes

### v1 Architecture
- **Database**: PostgreSQL via Docker Compose
- **Cache**: Redis via Docker Compose  
- **Vector Search**: Limited or no vector capabilities
- **Infrastructure**: Single-node Docker Compose
- **Credentials**: Stored in `.env` file

### v2 Architecture
- **Database**: PostgreSQL with pgvector on Kubernetes StatefulSets
- **Cache**: Redis on Kubernetes StatefulSets
- **Vector Search**: Advanced pgvector with HNSW/IVFFlat indexing
- **Hybrid Search**: Combined vector + full-text search
- **Infrastructure**: Kubernetes with persistent volumes
- **Credentials**: Kubernetes Secrets (derived from existing `.env`)

## Prerequisites

### Required Tools
```bash
# Database tools
sudo apt-get install postgresql-client

# Container orchestration
kubectl version --client
docker --version
docker-compose --version

# Node.js dependencies (automatically installed)
npm install
```

### Environment Requirements
- Kubernetes cluster (local or remote)
- Storage class supporting ReadWriteOnce (e.g., `local-path`)
- Existing v1 `.env` file with database credentials
- Backup storage space (recommend 2x your database size)

## Migration Process

### Phase 1: Preparation & Backup

1. **Verify v1 Health**
   ```bash
   # Check v1 database connectivity
   psql $DATABASE_URL -c "SELECT version();"
   
   # Verify current data
   psql $DATABASE_URL -c "SELECT COUNT(*) FROM users;"
   ```

2. **Run Migration**
   ```bash
   # Execute complete migration
   ./migrate-v1-to-v2.sh
   ```

The migration script handles:
- ✅ Database backup creation
- ✅ Kubernetes secret creation from `.env`
- ✅ Infrastructure deployment
- ✅ Data restoration with pgvector enhancement
- ✅ Database schema migrations
- ✅ Integration testing
- ✅ Environment configuration updates

### Phase 2: Validation

After migration, verify the system:

```bash
# Check v2 infrastructure status
npm run v2:status

# Verify database migrations
npm run db:status

# Run integration tests
npm run test:integration

# Check application connectivity
npm run v2:connect
```

### Phase 3: Application Cutover

1. **Update Environment**
   ```bash
   # Switch to v2 configuration
   cp .env.v2 .env
   ```

2. **Test Application**
   ```bash
   # Test backend connectivity
   npm run dev:backend
   
   # Verify vector search functionality
   curl http://localhost:8001/api/health
   ```

## New v2 Features

### Enhanced Vector Search
- **Unified embeddings table** supporting multiple source types
- **Automatic HNSW/IVFFlat indexing** based on data volume
- **Content change detection** via SHA256 hashing
- **Multiple embedding model support**

### Hybrid Search Capabilities
```sql
-- Example hybrid search (70% vector, 30% keyword)
SELECT * FROM hybrid_search(
  'artificial intelligence',
  '[0.1, 0.2, ...]'::vector(1536),
  0.7, 0.3, 0.8, 10
);
```

### Performance Monitoring
- Migration tracking via `schema_migrations` table
- Search performance metrics in `search_performance_metrics`
- Vector index statistics via `vector_search_stats` view

### Database Functions
- `upsert_embedding()` - Intelligent embedding management
- `similarity_search()` - Pure vector similarity search
- `hybrid_search()` - Combined vector + keyword search
- `rebuild_vector_indexes()` - Index maintenance utility

## Configuration Management

### Environment Variables

The migration preserves your existing `.env` structure:

```bash
# v1 settings (before migration)
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
DATABASE_URL=postgresql://user:pass@localhost:5432/db

# v2 settings (after migration) 
POSTGRES_HOST=localhost
POSTGRES_PORT=32432  # NodePort access
DATABASE_URL=postgresql://user:pass@localhost:32432/db
```

### Access Patterns

**Direct Kubernetes Access:**
```bash
# Port-forward for development
kubectl -n data-stack port-forward svc/postgres 5432:5432

# Use original connection settings
export DATABASE_URL=postgresql://user:pass@localhost:5432/db
```

**NodePort Access (default):**
```bash
# Access via NodePort (no port-forward needed)
export DATABASE_URL=postgresql://user:pass@localhost:32432/db
```

## Rollback Procedure

If issues arise, rollback to v1:

```bash
# Emergency rollback
./rollback-v2-to-v1.sh

# Manual rollback steps:
# 1. Stop v2 traffic
kubectl -n data-stack scale deployment --all --replicas=0

# 2. Restore v1 infrastructure  
docker-compose up -d

# 3. Restore database from backup
pg_restore -h localhost -p 5432 -U $POSTGRES_USER -d $POSTGRES_DB \
  backups/pre_migration_*.dump

# 4. Update environment
cp .env.v1 .env  # or manually update connection settings
```

## Monitoring & Troubleshooting

### Health Checks

```bash
# Kubernetes infrastructure
kubectl -n data-stack get pods,svc,pvc

# Database connectivity
psql postgresql://user:pass@localhost:32432/db -c "SELECT 1"

# pgvector functionality
psql postgresql://user:pass@localhost:32432/db -c "SELECT '[1,2,3]'::vector"

# Migration history
psql postgresql://user:pass@localhost:32432/db -c "
  SELECT version, applied_at FROM schema_migrations ORDER BY applied_at;"
```

### Common Issues

**pgvector Extension Missing:**
```sql
-- Check extension availability
SELECT name FROM pg_available_extensions WHERE name = 'vector';

-- Install if available
CREATE EXTENSION IF NOT EXISTS vector;
```

**Connection Issues:**
```bash
# Check NodePort services
kubectl -n data-stack get svc -o wide

# Verify port forwarding
kubectl -n data-stack port-forward svc/postgres 5432:5432 &
```

**Migration Checksum Errors:**
```bash
# Force migration (development only)
FORCE_MIGRATION=true npm run db:migrate
```

### Performance Tuning

**Vector Index Optimization:**
```sql
-- Check current indexes
SELECT schemaname, tablename, indexname 
FROM pg_indexes 
WHERE tablename = 'embeddings';

-- Rebuild indexes if needed
SELECT rebuild_vector_indexes();

-- Update statistics
ANALYZE embeddings;
```

**Query Performance:**
```sql
-- Monitor search performance
SELECT 
  search_type,
  AVG(execution_time_ms) as avg_time_ms,
  COUNT(*) as query_count
FROM search_performance_metrics 
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY search_type;
```

## File Reference

### Migration Files
- `db/migrations/` - Versioned SQL migrations
- `db/migrate.ts` - TypeScript migration runner
- `db/MIGRATION_MANIFEST.json` - Migration metadata

### Scripts
- `migrate-v1-to-v2.sh` - Complete migration orchestration
- `rollback-v2-to-v1.sh` - Emergency rollback procedure

### Kubernetes Manifests
- `k8s/pgvector-redis.yaml` - PostgreSQL + Redis StatefulSets
- `k8s/job-db-migrate.yaml` - Migration job (optional)

### Tests
- `tests/integration/db.connection.test.ts` - Connectivity tests
- `tests/integration/db.migration.test.ts` - Migration validation
- `tests/integration/db.vector.test.ts` - Vector functionality tests

## Support & Next Steps

### Migration Complete Checklist
- [ ] v1 database backed up
- [ ] Kubernetes infrastructure deployed
- [ ] Data migrated and verified
- [ ] pgvector functionality confirmed
- [ ] Application connectivity tested
- [ ] Integration tests passing
- [ ] Performance baseline established

### Optimization Opportunities
- Set up monitoring dashboards
- Configure automated backups
- Implement connection pooling
- Add read replicas for scaling
- Set up log aggregation

### Advanced Features Available
- Multi-modal embeddings support
- Hybrid retrieval configurations
- Cache invalidation strategies
- Performance metrics collection

For additional support, consult:
- Database logs: `npm run v2:logs`
- Migration history: `npm run db:status`
- Integration tests: `npm run test:integration`