-- Fix security issues: RLS policies

-- ==========================================
-- 1. deposit_log — add policies (currently RLS enabled but zero policies = locked)
-- ==========================================
DROP POLICY IF EXISTS "Auth read deposit_log" ON deposit_log;
CREATE POLICY "Auth read deposit_log" ON deposit_log
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Auth insert deposit_log" ON deposit_log;
CREATE POLICY "Auth insert deposit_log" ON deposit_log
    FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Admin update deposit_log" ON deposit_log;
CREATE POLICY "Admin update deposit_log" ON deposit_log
    FOR UPDATE TO authenticated
    USING (public.is_admin() OR EXISTS (
        SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'committee_member'
    ));

-- ==========================================
-- 2. owners UPDATE — restrict to admin only (was any authenticated user)
-- ==========================================
DROP POLICY IF EXISTS "Allow authenticated users to update owners" ON owners;
CREATE POLICY "Admin update owners" ON owners
    FOR UPDATE TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- ==========================================
-- 3. income UPDATE — restrict to admin/committee (was any authenticated user)
-- ==========================================
DROP POLICY IF EXISTS "Auth can update income" ON income;
CREATE POLICY "Admin committee update income" ON income
    FOR UPDATE TO authenticated
    USING (public.is_admin() OR EXISTS (
        SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'committee_member'
    ));

-- ==========================================
-- 4. food_coupon_registrations — restrict INSERT to authenticated (was anyone, including unauthenticated!)
-- ==========================================
DROP POLICY IF EXISTS "Anyone can insert registrations" ON food_coupon_registrations;
CREATE POLICY "Auth insert registrations" ON food_coupon_registrations
    FOR INSERT TO authenticated WITH CHECK (true);
