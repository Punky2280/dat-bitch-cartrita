-- packages/backend/setup_workflows_table.sql

-- Create the 'workflows' table if it doesn't already exist.
-- This table will store user-defined, multi-step automations.
CREATE TABLE IF NOT EXISTS workflows (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    name VARCHAR(255) NOT NULL,
    definition JSONB NOT NULL, -- Stores the array of steps for the workflow
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create an index on user_id for quickly fetching a user's workflows.
CREATE INDEX IF NOT EXISTS idx_workflows_user_id ON workflows(user_id);

-- A function to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- A trigger to call the function whenever a row is updated
DO
$$
BEGIN
   IF NOT EXISTS (
      SELECT 1 FROM pg_trigger
      WHERE tgname = 'set_timestamp' AND tgrelid = 'workflows'::regclass
   ) THEN
      CREATE TRIGGER set_timestamp
      BEFORE UPDATE ON workflows
      FOR EACH ROW
      EXECUTE PROCEDURE trigger_set_timestamp();
   END IF;
END
$$;

\echo "✅ 'workflows' table is ready."
