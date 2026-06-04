-- ============================================================
-- Gate & Security Management Module
-- Extends visitor_passes and adds monthly staff + audit log
-- ============================================================

-- 1. Extend visitor_passes for gate workflows
ALTER TABLE visitor_passes ADD COLUMN IF NOT EXISTS pass_type TEXT CHECK (pass_type IN ('immediate_inward','pre_auth_guest','monthly_pass'));
ALTER TABLE visitor_passes ADD COLUMN IF NOT EXISTS host_user_id UUID REFERENCES auth.users(id);
ALTER TABLE visitor_passes ADD COLUMN IF NOT EXISTS monthly_staff_id UUID;
ALTER TABLE visitor_passes ADD COLUMN IF NOT EXISTS expected_duration_min INTEGER DEFAULT 20;
ALTER TABLE visitor_passes ADD COLUMN IF NOT EXISTS notified_at TIMESTAMPTZ;
ALTER TABLE visitor_passes ADD COLUMN IF NOT EXISTS responded_at TIMESTAMPTZ;
ALTER TABLE visitor_passes ADD COLUMN IF NOT EXISTS checked_in_at TIMESTAMPTZ;
ALTER TABLE visitor_passes ADD COLUMN IF NOT EXISTS checked_out_at TIMESTAMPTZ;
ALTER TABLE visitor_passes ADD COLUMN IF NOT EXISTS company_name TEXT;
ALTER TABLE visitor_passes ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- 2. Monthly staff directory (maids, cooks, drivers, etc.)
CREATE TABLE IF NOT EXISTS monthly_staff (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    flat_no TEXT NOT NULL,
    name TEXT NOT NULL,
    phone TEXT DEFAULT '',
    photo_url TEXT DEFAULT '',
    id_card_no TEXT DEFAULT '',
    purpose TEXT DEFAULT '', -- maid, cook, driver, tutor, etc.
    working_days TEXT DEFAULT 'all', -- all, weekdays, custom
    entry_time TIME DEFAULT '07:00',
    exit_time TIME DEFAULT '18:00',
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Gate attendance ledger (check-in/check-out log)
CREATE TABLE IF NOT EXISTS gate_log (
    id BIGSERIAL PRIMARY KEY,
    pass_id UUID REFERENCES visitor_passes(id) ON DELETE SET NULL,
    staff_id UUID REFERENCES monthly_staff(id) ON DELETE SET NULL,
    action TEXT NOT NULL CHECK (action IN ('check_in','check_out','approve','deny')),
    performed_by UUID REFERENCES auth.users(id),
    flat_no TEXT NOT NULL,
    visitor_name TEXT,
    remarks TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Enable realtime for instant push
ALTER PUBLICATION supabase_realtime ADD TABLE visitor_passes;
ALTER PUBLICATION supabase_realtime ADD TABLE monthly_staff;
ALTER PUBLICATION supabase_realtime ADD TABLE gate_log;

-- 5. RLS policies for gate_passes (read:authenticated, write:by role)
DROP POLICY IF EXISTS "Anyone can read visitor_passes" ON visitor_passes;
CREATE POLICY "Anyone can read visitor_passes" ON visitor_passes FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated can create visitor_passes" ON visitor_passes;
CREATE POLICY "Authenticated can create visitor_passes" ON visitor_passes FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Gate update policy" ON visitor_passes;
CREATE POLICY "Gate update policy" ON visitor_passes FOR UPDATE USING (auth.role() = 'authenticated');

-- RLS for monthly_staff
ALTER TABLE monthly_staff ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read monthly_staff" ON monthly_staff;
CREATE POLICY "Anyone can read monthly_staff" ON monthly_staff FOR SELECT USING (true);
DROP POLICY IF EXISTS "Authenticated can manage monthly_staff" ON monthly_staff;
CREATE POLICY "Authenticated can manage monthly_staff" ON monthly_staff FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated can update monthly_staff" ON monthly_staff FOR UPDATE USING (auth.role() = 'authenticated');

-- RLS for gate_log
ALTER TABLE gate_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read gate_log" ON gate_log;
CREATE POLICY "Anyone can read gate_log" ON gate_log FOR SELECT USING (true);
DROP POLICY IF EXISTS "Authenticated can insert gate_log" ON gate_log;
CREATE POLICY "Authenticated can insert gate_log" ON gate_log FOR INSERT WITH CHECK (auth.role() = 'authenticated');
