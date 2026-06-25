-- Audit log table for tracking all significant actions (super_admin only view)
CREATE TABLE IF NOT EXISTS audit_log (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id),
    user_email TEXT,
    action TEXT NOT NULL,
    details JSONB DEFAULT '{}'::jsonb,
    ip_address TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast queries
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_log_user_email ON audit_log(user_email);

-- Enable RLS
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Super admin can read audit log" ON audit_log;
DROP POLICY IF EXISTS "Admin can read audit log" ON audit_log;
DROP POLICY IF EXISTS "Authenticated can insert audit log" ON audit_log;

-- Only super_admin and admin can read
CREATE POLICY "Admin can read audit log" ON audit_log
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND (role = 'super_admin' OR role = 'admin')
        )
    );

-- Any authenticated user can insert (we want to capture all actions)
CREATE POLICY "Authenticated can insert audit log" ON audit_log
    FOR INSERT TO authenticated WITH CHECK (true);
