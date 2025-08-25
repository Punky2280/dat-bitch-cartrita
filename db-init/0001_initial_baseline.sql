-- Baseline migration marker for v1 -> v2 transition
-- Creates migrations table if not exists and establishes baseline

CREATE TABLE IF NOT EXISTS schema_migrations (
    version TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    checksum TEXT NOT NULL,
    description TEXT,
    migration_type VARCHAR(50) DEFAULT 'ddl'
);

-- Record baseline marker
INSERT INTO schema_migrations (version, checksum, description, migration_type)
VALUES (
    '0001_initial_baseline.sql',
    'SHA256:BASELINE_MARKER_V1_TO_V2_TRANSITION',
    'Baseline marker for v1 to v2 migration - establishes migration tracking',
    'baseline'
) ON CONFLICT (version) DO NOTHING;

-- Comment for tracking
-- This baseline assumes your existing v1 schema is already in place
-- Run this to establish migration tracking before applying subsequent migrations