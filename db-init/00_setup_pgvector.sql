-- =====================================================
-- PostgreSQL Extension Setup
-- =====================================================
-- This script should ONLY be used to enable extensions.

CREATE EXTENSION IF NOT EXISTS vector;


DO $$
BEGIN
  RAISE NOTICE '✅ Enabled vector and timescaledb extensions.';
END $$;