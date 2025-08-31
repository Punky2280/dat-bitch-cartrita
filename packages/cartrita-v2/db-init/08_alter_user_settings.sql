-- =====================================================
-- USER_SETTINGS TABLE EXTENSION - Add Theme, Language, and Audio Settings
-- =====================================================

-- Add new columns to user_settings table
ALTER TABLE user_settings 
ADD COLUMN IF NOT EXISTS theme TEXT DEFAULT 'dark' CHECK (theme IN ('dark', 'light', 'cyberpunk', 'neon', 'minimal')),
ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'en',
ADD COLUMN IF NOT EXISTS voice_responses BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS ambient_listening BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS sound_effects BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS camera_enabled BOOLEAN DEFAULT FALSE;

-- Update existing users with default values for new columns (in case they were NULL)
UPDATE user_settings 
SET 
  theme = COALESCE(theme, 'dark'),
  language = COALESCE(language, 'en'),
  voice_responses = COALESCE(voice_responses, FALSE),
  ambient_listening = COALESCE(ambient_listening, FALSE),
  sound_effects = COALESCE(sound_effects, TRUE),
  camera_enabled = COALESCE(camera_enabled, FALSE),
  updated_at = NOW()
WHERE theme IS NULL OR language IS NULL OR voice_responses IS NULL OR ambient_listening IS NULL OR sound_effects IS NULL OR camera_enabled IS NULL;

-- ✅ User_settings table extended with theme, language, audio settings, and camera permissions