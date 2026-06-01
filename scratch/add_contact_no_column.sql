-- Add contact_no column to owners table (if missing)
ALTER TABLE owners ADD COLUMN IF NOT EXISTS contact_no TEXT DEFAULT '';

-- Ensure RLS allows authenticated users to update owners
-- (adjust policy name/definition as needed for your profiles structure)
-- If you see "permission denied" when saving, uncomment and run these:

-- CREATE POLICY "Allow authenticated users to update owners" ON owners
--     FOR UPDATE USING (auth.role() = 'authenticated')
--     WITH CHECK (auth.role() = 'authenticated');
