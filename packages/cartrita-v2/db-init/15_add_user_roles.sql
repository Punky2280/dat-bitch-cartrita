-- Add role and is_admin columns to users table
-- This migration adds role-based access control to the authentication system

-- Add role column with default 'user' role (PostgreSQL syntax)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='role') THEN
        ALTER TABLE users ADD COLUMN role VARCHAR(50) DEFAULT 'user' NOT NULL;
    END IF;
END $$;

-- Add is_admin boolean flag for convenience
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='is_admin') THEN
        ALTER TABLE users ADD COLUMN is_admin BOOLEAN DEFAULT FALSE NOT NULL;
    END IF;
END $$;

-- Create index for efficient role-based queries
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_is_admin ON users(is_admin);

-- Set up some initial admin users (can be customized based on email patterns)
-- Example: make users with certain email domains admin
UPDATE users SET role = 'admin', is_admin = TRUE 
WHERE email ILIKE '%@cartrita.com' OR email ILIKE '%@admin.%' OR email = 'robert@example.com';

-- Create roles table for future extensibility
CREATE TABLE IF NOT EXISTS user_roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    permissions TEXT[], -- JSON array of permission strings
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Insert default roles
INSERT INTO user_roles (name, display_name, description, permissions) VALUES
('admin', 'Administrator', 'Full system access', ARRAY['*'])
ON CONFLICT (name) DO NOTHING;

INSERT INTO user_roles (name, display_name, description, permissions) VALUES
('user', 'Standard User', 'Basic user access', ARRAY['read:own', 'write:own'])
ON CONFLICT (name) DO NOTHING;

INSERT INTO user_roles (name, display_name, description, permissions) VALUES
('moderator', 'Moderator', 'Content moderation access', ARRAY['read:*', 'moderate:content'])
ON CONFLICT (name) DO NOTHING;

-- Add foreign key constraint to users table
ALTER TABLE users 
ADD CONSTRAINT fk_users_role 
FOREIGN KEY (role) REFERENCES user_roles(name) 
ON UPDATE CASCADE ON DELETE SET DEFAULT;

COMMENT ON COLUMN users.role IS 'User role - references user_roles.name';
COMMENT ON COLUMN users.is_admin IS 'Quick admin check flag - true if role grants admin access';
COMMENT ON TABLE user_roles IS 'Defines available user roles and their permissions';
