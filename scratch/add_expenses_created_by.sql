-- Add created_by and created_at columns to expenses table
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS created_by TEXT;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- Also ensure RLS policies exist (in case add_missing_rls_policies.sql hasn't been run yet)
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Auth read expenses" ON expenses;
DROP POLICY IF EXISTS "Auth insert expenses" ON expenses;
DROP POLICY IF EXISTS "Auth update expenses" ON expenses;
DROP POLICY IF EXISTS "Auth delete expenses" ON expenses;

CREATE POLICY "Auth read expenses" ON expenses FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert expenses" ON expenses FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update expenses" ON expenses FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Auth delete expenses" ON expenses FOR DELETE TO authenticated USING (public.is_admin());
