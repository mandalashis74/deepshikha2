-- Broaden income UPDATE policy to include editor and floor_manager roles (not just admin/committee)
DROP POLICY IF EXISTS "Admin committee update income" ON income;
CREATE POLICY "Income update" ON income
    FOR UPDATE TO authenticated
    USING (
        public.is_admin() OR
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
            AND role IN ('committee_member', 'editor', 'floor_manager')
        )
    );
