-- Fix consent records for existing users with correct column names

-- Insert default consent records for existing users using correct column names
INSERT INTO user_consent_records (user_id, consent_type, consent_given, consent_details, consent_date)
SELECT u.id, 'data_processing', true, '{"scope": "essential_features", "purpose": "Core functionality"}'::jsonb, NOW() FROM users u
WHERE NOT EXISTS (
    SELECT 1 FROM user_consent_records 
    WHERE user_id = u.id AND consent_type = 'data_processing'
);

INSERT INTO user_consent_records (user_id, consent_type, consent_given, consent_details, consent_date)
SELECT u.id, 'service_improvement', false, '{"scope": "analytics", "purpose": "Product improvement"}'::jsonb, NOW() FROM users u
WHERE NOT EXISTS (
    SELECT 1 FROM user_consent_records 
    WHERE user_id = u.id AND consent_type = 'service_improvement'
);

-- Update existing records to have received_at = internal_date where received_at is null
UPDATE user_email_messages 
SET received_at = internal_date 
WHERE received_at IS NULL AND internal_date IS NOT NULL;

-- Update existing records to have internal_date = received_at where internal_date is null  
UPDATE user_email_messages 
SET internal_date = received_at 
WHERE internal_date IS NULL AND received_at IS NOT NULL;

-- ✅ Schema fixes complete