-- Run this SQL in your Supabase SQL Editor to create the roles table and seed defaults
-- This enables dynamic role management (add/edit/delete roles with custom permissions)

-- 1. Create roles table
CREATE TABLE IF NOT EXISTS roles (
    id SERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    label TEXT NOT NULL,
    permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
    color TEXT DEFAULT 'var(--text-secondary)',
    priority INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Enable RLS
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;

-- 3. Allow authenticated users to read roles (needed for permission checks)
CREATE POLICY "Allow read access to all authenticated users" ON roles
    FOR SELECT USING (auth.role() = 'authenticated');

-- 4. Allow only admins to insert/update/delete roles
-- Adjust this policy name/definition based on your existing profiles table structure
CREATE POLICY "Allow admin write access" ON roles
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- 5. Seed default roles (matching the original hardcoded roles)
INSERT INTO roles (name, label, permissions, color, priority) VALUES
('admin', 'Administrator',
 '["dashboard:view","income:create","income:delete","expense:create","expense:delete","history:view","reports:view","ledger:import","ledger:export","owners:upload","owners:edit_any","owners:edit_own","expense_heads:manage","expense_heads:create","expense_heads:delete","users:manage","users:role_change","tickets:assign","tickets:recommend","tickets:approve","tickets:resolve","tickets:close","tickets:reopen","tickets:archive","tickets:delete","tickets:comment"]'::jsonb,
 'var(--color-emerald)', 100),
('editor', 'Editor',
 '["dashboard:view","income:create","expense:create","history:view","reports:view","ledger:export","tickets:resolve","tickets:comment"]'::jsonb,
 'var(--color-rose)', 80),
('floor_manager', 'Floor Manager',
 '["dashboard:view","income:create","history:view","reports:view","tickets:recommend","tickets:comment"]'::jsonb,
 'var(--color-yellow)', 60),
('committee_member', 'Committee Member',
 '["dashboard:view","history:view","reports:view","tickets:approve","tickets:comment"]'::jsonb,
 'var(--color-violet)', 40),
('viewer', 'Viewer (Resident)',
 '["owners:edit_own","tickets:comment"]'::jsonb,
 'var(--text-secondary)', 20)
ON CONFLICT (name) DO NOTHING;

-- 6. Add assigned_floors column to profiles (for floor manager floor assignments)
-- Run this separately if the column does not exist yet:
-- ALTER TABLE profiles ADD COLUMN IF NOT EXISTS assigned_floors JSONB DEFAULT '[]'::jsonb;
