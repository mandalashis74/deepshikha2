-- Enable RLS on owners table (safe to run if already enabled)
ALTER TABLE owners ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if any, then create
DROP POLICY IF EXISTS "Allow authenticated users to update owners" ON owners;
CREATE POLICY "Allow authenticated users to update owners" ON owners
    FOR UPDATE USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

-- Allow authenticated users to SELECT owners
DROP POLICY IF EXISTS "Allow authenticated users to read owners" ON owners;
CREATE POLICY "Allow authenticated users to read owners" ON owners
    FOR SELECT USING (auth.role() = 'authenticated');
