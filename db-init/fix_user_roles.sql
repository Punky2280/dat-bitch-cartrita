-- Add role and is_admin columns to users table if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='role') THEN
        ALTER TABLE users ADD COLUMN role VARCHAR(50) DEFAULT 'user' NOT NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='is_admin') THEN
        ALTER TABLE users ADD COLUMN is_admin BOOLEAN DEFAULT FALSE NOT NULL;
    END IF;
END $$;

-- Create indexes for efficient role-based queries
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_is_admin ON users(is_admin);

-- Create a simplified user_roles table
CREATE TABLE IF NOT EXISTS user_roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Insert basic roles
INSERT INTO user_roles (name, description) VALUES
('admin', 'Administrator with full system access'),
('user', 'Standard user with basic access'),
('moderator', 'Moderator with content management access')
ON CONFLICT (name) DO NOTHING;

-- Update any existing admin users
UPDATE users SET role = 'admin', is_admin = TRUE 
WHERE email ILIKE '%@cartrita.com' OR email ILIKE '%@admin.%' OR email = 'robert@example.com';
