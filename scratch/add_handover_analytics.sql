-- Phase 4: Committee Handover Tool + Phase 5: Admin Dashboard Analytics

CREATE TABLE IF NOT EXISTS committee_handovers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    from_term TEXT NOT NULL,
    to_term TEXT NOT NULL,
    handover_date DATE NOT NULL DEFAULT CURRENT_DATE,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','in_progress','completed','cancelled')),
    notes TEXT DEFAULT '',
    created_by UUID REFERENCES auth.users(id),
    acknowledged_by UUID REFERENCES auth.users(id),
    acknowledged_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS handover_checklist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    handover_id UUID REFERENCES committee_handovers(id) ON DELETE CASCADE,
    section TEXT NOT NULL,
    item TEXT NOT NULL,
    is_completed BOOLEAN DEFAULT false,
    completed_by UUID REFERENCES auth.users(id),
    completed_at TIMESTAMPTZ,
    notes TEXT DEFAULT '',
    sort_order INT DEFAULT 0
);

ALTER TABLE committee_handovers ENABLE ROW LEVEL SECURITY;
ALTER TABLE handover_checklist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read handovers" ON committee_handovers FOR SELECT USING (true);
CREATE POLICY "Admin/committee can create handovers" ON committee_handovers FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','committee_member'))
);
CREATE POLICY "Admin/committee can update handovers" ON committee_handovers FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','committee_member'))
);
CREATE POLICY "Admin can delete handovers" ON committee_handovers FOR DELETE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Anyone can read checklist" ON handover_checklist FOR SELECT USING (true);
CREATE POLICY "Admin/committee can manage checklist" ON handover_checklist FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','committee_member'))
);
