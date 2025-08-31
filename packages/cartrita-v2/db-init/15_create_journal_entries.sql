-- 15_create_journal_entries.sql
-- Adds journal_entries table for Personal Life OS journal feature.
-- Follows additive migration pattern; do not modify previous migrations.

-- Ensure uuid extension (mirrors style in other migrations that call uuid-ossp)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS journal_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    entry_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    content TEXT NOT NULL,
    mood TEXT,
    sentiment_score DOUBLE PRECISION,
    emotions JSONB,              -- { "joy":0.2, "stress":0.4, ... }
    derived_tasks JSONB,         -- array of suggested tasks objects { title, description }
    embeddings TEXT,             -- bracketed float string if embeddings stored here
    tags TEXT[],
    is_private BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_journal_entries_user_date ON journal_entries(user_id, entry_date DESC);
CREATE INDEX IF NOT EXISTS idx_journal_entries_tags ON journal_entries USING GIN (tags);
CREATE INDEX IF NOT EXISTS idx_journal_entries_emotions ON journal_entries USING GIN (emotions);

-- Future: journal_entry_attachments table for media references.
