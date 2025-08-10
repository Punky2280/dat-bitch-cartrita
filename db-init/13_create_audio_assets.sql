-- Migration 13: Audio assets & pipeline tracking
-- Date: 2025-08-10
-- Creates audio_assets table for ingest/transcription/voice swap/tts pipeline

BEGIN;

CREATE TABLE IF NOT EXISTS audio_assets (
  id BIGSERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  original_filename TEXT,
  storage_path TEXT NOT NULL,
  mime_type TEXT,
  size_bytes BIGINT,
  checksum TEXT,
  duration_seconds NUMERIC(10,3),
  transcript TEXT,
  transcript_provider TEXT,
  transcript_confidence NUMERIC(5,2),
  voice_swap_model TEXT,
  tts_model TEXT,
  tts_text TEXT,
  status TEXT NOT NULL DEFAULT 'ingested', -- ingested|preprocessed|transcribed|voice_swapped|tts_generated|error
  stages JSONB, -- per-stage metadata { ingest:{...}, preprocess:{...}, stt:{...}, voice_swap:{...}, tts:{...} }
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audio_assets_user ON audio_assets(user_id);
CREATE INDEX IF NOT EXISTS idx_audio_assets_status ON audio_assets(status);
CREATE INDEX IF NOT EXISTS idx_audio_assets_created_at ON audio_assets(created_at);

COMMIT;

DO $$ BEGIN RAISE NOTICE '✅ Migration 13_create_audio_assets applied.'; END $$;
