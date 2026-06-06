-- Add name, address, contact_no columns to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS contact_no TEXT;

-- Sync existing names from auth.users metadata
UPDATE profiles p
SET name = u.raw_user_meta_data->>'full_name'
FROM auth.users u
WHERE p.id = u.id
  AND p.name IS NULL
  AND u.raw_user_meta_data->>'full_name' IS NOT NULL;

-- Add avatar_url column (stores compressed base64 data URL — no storage bucket needed)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Allow users to insert their own profile row (needed for upsert/update to work)
CREATE POLICY "Allow users to insert own profile" ON public.profiles
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = id);
