-- =====================================================
-- PostgreSQL Extension Setup
-- =====================================================
-- This script should ONLY be used to enable extensions.

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS timescaledb;

DO $$
BEGIN
  RAISE NOTICE '✅ Enabled vector and timescaledb extensions.';
END $$;