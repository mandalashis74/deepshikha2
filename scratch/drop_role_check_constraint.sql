-- Run this SQL in your Supabase SQL Editor to drop the restrictive check constraint.
-- This allows assigning new/custom roles to users under the dynamic role system.

-- 1. Drop the check constraint that restricts roles to a hardcoded list
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

-- 2. (Optional but recommended) Add a foreign key constraint so only roles defined
-- in the "roles" table can be assigned to users, and updates propagate automatically.
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_fkey;
ALTER TABLE public.profiles 
    ADD CONSTRAINT profiles_role_fkey 
    FOREIGN KEY (role) 
    REFERENCES public.roles(name) 
    ON UPDATE CASCADE;
