-- Fix RLS policy on income table to allow inserts from authenticated users

-- Enable RLS (safe to run if already enabled)
ALTER TABLE income ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to recreate
DROP POLICY IF EXISTS "Anyone can read income" ON income;
DROP POLICY IF EXISTS "Auth can insert income" ON income;
DROP POLICY IF EXISTS "Admin can update income" ON income;
DROP POLICY IF EXISTS "Auth can update own or admin" ON income;

-- Allow all authenticated users to read income
CREATE POLICY "Anyone can read income" ON income
    FOR SELECT USING (true);

-- Allow authenticated users to insert income (for self-service payments)
CREATE POLICY "Auth can insert income" ON income
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Allow authenticated users to update income (for approve/reject workflow)
CREATE POLICY "Auth can update income" ON income
    FOR UPDATE USING (auth.role() = 'authenticated');
