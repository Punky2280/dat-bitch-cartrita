-- ============================================================================
-- Targeted Database Schema Fixes
-- ============================================================================

-- Fix 1: Add missing updated_at column to conversations
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'conversations' AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE conversations ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
        UPDATE conversations SET updated_at = started_at WHERE updated_at IS NULL;
    END IF;
END $$;

-- Fix 2: Check and fix knowledge_relationships columns
DO $$
BEGIN
    -- Add source_node_id if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'knowledge_relationships' AND column_name = 'source_node_id'
    ) THEN
        ALTER TABLE knowledge_relationships ADD COLUMN source_node_id INTEGER NOT NULL DEFAULT 0;
    END IF;
    
    -- Add target_node_id if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'knowledge_relationships' AND column_name = 'target_node_id'
    ) THEN
        ALTER TABLE knowledge_relationships ADD COLUMN target_node_id INTEGER NOT NULL DEFAULT 0;
    END IF;
END $$;

-- Fix 3: Create missing indexes (only if columns exist)
DO $$
BEGIN
    -- Index for conversations with updated_at
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'conversations' AND column_name = 'updated_at'
    ) THEN
        CREATE INDEX IF NOT EXISTS idx_conversations_user_active_updated 
        ON conversations(user_id, is_active, updated_at DESC);
    END IF;
    
    -- Index for workflow_schedules with next_run_at
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'workflow_schedules' AND column_name = 'next_run_at'
    ) THEN
        CREATE INDEX IF NOT EXISTS idx_workflow_schedules_active_next_run 
        ON workflow_schedules(is_active, next_run_at) WHERE is_active = true;
    END IF;
    
    -- Indexes for knowledge_relationships
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'knowledge_relationships' AND column_name = 'source_node_id'
    ) THEN
        CREATE INDEX IF NOT EXISTS idx_knowledge_relationships_source 
        ON knowledge_relationships(source_node_id);
    END IF;
    
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'knowledge_relationships' AND column_name = 'target_node_id'
    ) THEN
        CREATE INDEX IF NOT EXISTS idx_knowledge_relationships_target 
        ON knowledge_relationships(target_node_id);
    END IF;
END $$;

-- Verify the fixes
SELECT 'Schema fixes completed!' as status;
