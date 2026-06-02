-- Phase 4: Vendor Mgmt, Visitor Passes, Asset Inventory, Polls, Parking
-- Run in Supabase SQL Editor

-- 1. VENDORS & CONTRACTS
CREATE TABLE IF NOT EXISTS vendors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    contact_person TEXT DEFAULT '',
    phone TEXT DEFAULT '',
    email TEXT DEFAULT '',
    service_type TEXT NOT NULL DEFAULT 'general',
    contract_start DATE,
    contract_end DATE,
    amc_amount NUMERIC(12,2) DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','expired','terminated')),
    documents_url TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. VISITOR PASSES
CREATE TABLE IF NOT EXISTS visitor_passes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    visitor_name TEXT NOT NULL,
    phone TEXT DEFAULT '',
    flat_no TEXT NOT NULL,
    purpose TEXT DEFAULT '',
    vehicle_no TEXT DEFAULT '',
    vehicle_type TEXT DEFAULT 'none' CHECK (vehicle_type IN ('none','car','bike','other')),
    valid_from TIMESTAMPTZ NOT NULL DEFAULT now(),
    valid_until TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','checked_in','checked_out','expired','rejected')),
    approved_by UUID REFERENCES auth.users(id),
    qr_token TEXT DEFAULT '',
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. ASSET INVENTORY
CREATE TABLE IF NOT EXISTS assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'equipment' CHECK (category IN ('equipment','furniture','electrical','plumbing','safety','it','other')),
    location TEXT DEFAULT '',
    purchase_date DATE,
    purchase_cost NUMERIC(12,2) DEFAULT 0,
    warranty_expiry DATE,
    serial_no TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'operational' CHECK (status IN ('operational','under_maintenance','broken','decommissioned')),
    notes TEXT DEFAULT '',
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. MAINTENANCE SCHEDULES
CREATE TABLE IF NOT EXISTS maintenance_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id UUID REFERENCES assets(id) ON DELETE CASCADE,
    task TEXT NOT NULL,
    frequency TEXT NOT NULL DEFAULT 'monthly' CHECK (frequency IN ('weekly','monthly','quarterly','yearly','custom')),
    last_done DATE,
    next_due DATE,
    assigned_to TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. POLLS & SURVEYS
CREATE TABLE IF NOT EXISTS polls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    options JSONB NOT NULL DEFAULT '[]'::jsonb,
    type TEXT NOT NULL DEFAULT 'single' CHECK (type IN ('single','multiple')),
    expires_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','closed')),
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS poll_votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    poll_id UUID REFERENCES polls(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id),
    selected_options INTEGER[] NOT NULL DEFAULT '{}',
    voted_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(poll_id, user_id)
);

-- 6. PARKING SLOTS
CREATE TABLE IF NOT EXISTS parking_slots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slot_number TEXT NOT NULL UNIQUE,
    floor TEXT DEFAULT '',
    type TEXT NOT NULL DEFAULT 'car' CHECK (type IN ('car','bike','visitor','disabled')),
    status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available','allotted','reserved','maintenance')),
    allotted_to_flat TEXT DEFAULT '',
    vehicle_no TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE visitor_passes ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE poll_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE parking_slots ENABLE ROW LEVEL SECURITY;

-- RLS Policies (read-all, write-authenticated with admin/committee checks)
CREATE POLICY "Anyone can read vendors" ON vendors FOR SELECT USING (true);
CREATE POLICY "Auth can insert vendors" ON vendors FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Admin/committee can update vendors" ON vendors FOR UPDATE USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','committee_member')));
CREATE POLICY "Admin can delete vendors" ON vendors FOR DELETE USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Anyone can read passes" ON visitor_passes FOR SELECT USING (true);
CREATE POLICY "Auth can create passes" ON visitor_passes FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Auth can update own or admin" ON visitor_passes FOR UPDATE USING (auth.uid() = created_by OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','committee_member')));

CREATE POLICY "Anyone can read assets" ON assets FOR SELECT USING (true);
CREATE POLICY "Auth can insert assets" ON assets FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Admin/committee can update assets" ON assets FOR UPDATE USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','committee_member')));
CREATE POLICY "Admin can delete assets" ON assets FOR DELETE USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Anyone can read maintenance" ON maintenance_schedules FOR SELECT USING (true);
CREATE POLICY "Auth can manage maintenance" ON maintenance_schedules FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Anyone can read polls" ON polls FOR SELECT USING (true);
CREATE POLICY "Auth can create polls" ON polls FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Creator or admin can update polls" ON polls FOR UPDATE USING (auth.uid() = created_by OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Anyone can read votes (aggregate)" ON poll_votes FOR SELECT USING (true);
CREATE POLICY "Users can vote" ON poll_votes FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Users can update own vote" ON poll_votes FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Anyone can read parking" ON parking_slots FOR SELECT USING (true);
CREATE POLICY "Admin/committee can manage parking" ON parking_slots FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','committee_member')));
