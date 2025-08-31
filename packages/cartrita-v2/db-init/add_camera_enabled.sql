-- Add camera_enabled column to user_settings table
-- This migration adds support for camera permissions in settings

DO $$ 
BEGIN
    -- Check if the column already exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_settings' 
        AND column_name = 'camera_enabled'
    ) THEN
        -- Add the camera_enabled column
        ALTER TABLE user_settings 
        ADD COLUMN camera_enabled BOOLEAN NOT NULL DEFAULT FALSE;
        
        RAISE NOTICE 'Added camera_enabled column to user_settings table';
    ELSE
        RAISE NOTICE 'camera_enabled column already exists in user_settings table';
    END IF;
END $$;

-- Update any existing records to have the default value
UPDATE user_settings 
SET camera_enabled = FALSE 
WHERE camera_enabled IS NULL;

-- Add a comment to document the column
COMMENT ON COLUMN user_settings.camera_enabled IS 'Whether camera access is enabled for this user (for Iteration 21 multi-modal features)';