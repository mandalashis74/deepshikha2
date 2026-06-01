-- 1. Create a security definer function to check if the current user is an administrator.
-- This avoids infinite recursion in RLS policies on the profiles table.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN SECURITY DEFINER AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql;

-- 2. Enable RLS on the profiles table
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3. Drop existing policies on profiles if they exist to start fresh
DROP POLICY IF EXISTS "Allow select for authenticated users" ON public.profiles;
DROP POLICY IF EXISTS "Allow update for users" ON public.profiles;
DROP POLICY IF EXISTS "Allow users to read profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow users to update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Allow admins to update all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow admin write access to profiles" ON public.profiles;

-- 4. Create SELECT policy: authenticated users can read all profiles
-- (needed so the Manage Users list can be displayed in the UI)
CREATE POLICY "Allow users to read profiles" ON public.profiles
    FOR SELECT
    TO authenticated
    USING (true);

-- 5. Create UPDATE policy: users can update their own profile, or admins can update any profile
CREATE POLICY "Allow users or admins to update profiles" ON public.profiles
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = id OR public.is_admin())
    WITH CHECK (auth.uid() = id OR public.is_admin());
