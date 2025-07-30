-- =====================================================
-- WORKFLOWS TABLE SETUP
-- =====================================================

-- Create workflows table (depends on users)
CREATE TABLE IF NOT EXISTS workflows (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  definition JSONB NOT NULL, -- Array of workflow steps
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_workflows_user_id ON workflows(user_id);
CREATE INDEX IF NOT EXISTS idx_workflows_active ON workflows(is_active);

-- Add update trigger
DO
$$
BEGIN
 IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'set_timestamp_workflows' AND tgrelid = 'workflows'::regclass
 ) THEN
    CREATE TRIGGER set_timestamp_workflows
    BEFORE UPDATE ON workflows
    FOR EACH ROW
    EXECUTE PROCEDURE trigger_set_timestamp();
 END IF;
END
$$;

\echo "✅ Workflows table is ready."
