-- Secure sensitive app secrets in a separate table with admin-only RLS

-- 1. Create app_secrets table for sensitive data
CREATE TABLE IF NOT EXISTS public.app_secrets (
    id INTEGER PRIMARY KEY DEFAULT 1,
    vapid_private_key TEXT DEFAULT '',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO public.app_secrets (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- Add super_admin_user_id column (hidden super admin, excluded from user listing)
ALTER TABLE public.app_secrets ADD COLUMN IF NOT EXISTS super_admin_user_id UUID DEFAULT NULL;

ALTER TABLE public.app_secrets ENABLE ROW LEVEL SECURITY;

-- Only admins can read secrets
DROP POLICY IF EXISTS "Admin read app_secrets" ON public.app_secrets;
CREATE POLICY "Admin read app_secrets" ON public.app_secrets
    FOR SELECT
    TO authenticated
    USING (public.is_admin());

-- Only admins can modify secrets
DROP POLICY IF EXISTS "Admin manage app_secrets" ON public.app_secrets;
CREATE POLICY "Admin manage app_secrets" ON public.app_secrets
    FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- 2. Remove vapid_private_key from building_config
ALTER TABLE public.building_config DROP COLUMN IF EXISTS vapid_private_key;

-- 3. Enable RLS on building_config (was entirely missing!)
ALTER TABLE public.building_config ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read building_config
DROP POLICY IF EXISTS "Authenticated read building_config" ON public.building_config;
CREATE POLICY "Authenticated read building_config" ON public.building_config
    FOR SELECT
    TO authenticated
    USING (true);

-- Only admins can modify building_config
DROP POLICY IF EXISTS "Admin modify building_config" ON public.building_config;
CREATE POLICY "Admin modify building_config" ON public.building_config
    FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());
