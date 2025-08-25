-- 16_tool_registry_schema.sql
-- Tool registry persistence (definitions, versions, embeddings)

CREATE TABLE IF NOT EXISTS tool_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  category TEXT,
  version INT NOT NULL DEFAULT 1,
  description TEXT,
  schema_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tool_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tool_id UUID NOT NULL REFERENCES tool_definitions(id) ON DELETE CASCADE,
  version INT NOT NULL,
  schema_json JSONB NOT NULL,
  added_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Using pgvector style noted in project (bracketed float string) - store raw text column
CREATE TABLE IF NOT EXISTS tool_embeddings (
  tool_id UUID PRIMARY KEY REFERENCES tool_definitions(id) ON DELETE CASCADE,
  embedding TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tool_definitions_name ON tool_definitions(name);
CREATE INDEX IF NOT EXISTS idx_tool_versions_tool_id ON tool_versions(tool_id);
