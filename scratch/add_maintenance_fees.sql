-- Maintenance Fees Module
-- Rate cards with effective dates + monthly collection records

CREATE TABLE IF NOT EXISTS maintenance_rates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    flat_type TEXT NOT NULL,
    amount NUMERIC(12,2) NOT NULL,
    effective_from DATE NOT NULL,
    effective_to DATE,
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS maintenance_collections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    flat_no TEXT NOT NULL,
    flat_type TEXT NOT NULL,
    owner_name TEXT DEFAULT '',
    month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
    year INTEGER NOT NULL,
    amount NUMERIC(12,2) NOT NULL,
    rate_id UUID REFERENCES maintenance_rates(id),
    paid_date DATE NOT NULL DEFAULT CURRENT_DATE,
    payment_method TEXT NOT NULL DEFAULT 'cash' CHECK (payment_method IN ('cash','bank_transfer','cheque','upi','other')),
    transaction_ref TEXT DEFAULT '',
    remarks TEXT DEFAULT '',
    collected_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(flat_no, month, year)
);

ALTER TABLE maintenance_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_collections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read rates" ON maintenance_rates FOR SELECT USING (true);
CREATE POLICY "Admin/committee can manage rates" ON maintenance_rates FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','committee_member'))
);

CREATE POLICY "Anyone can read collections" ON maintenance_collections FOR SELECT USING (true);
CREATE POLICY "Admin/committee can manage collections" ON maintenance_collections FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','committee_member'))
);

-- Security Personnel shift-wise roster
CREATE TABLE IF NOT EXISTS security_personnel (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    shift TEXT NOT NULL CHECK (shift IN ('morning','evening','night')),
    phone TEXT DEFAULT '',
    designation TEXT DEFAULT 'Security Guard',
    photo_url TEXT DEFAULT '',
    start_date DATE DEFAULT CURRENT_DATE,
    is_active BOOLEAN DEFAULT true,
    display_order INTEGER DEFAULT 0,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE security_personnel ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read security" ON security_personnel FOR SELECT USING (true);
CREATE POLICY "Admin/committee can manage security" ON security_personnel FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','committee_member'))
);

-- Add tenant_name column to owners table
ALTER TABLE owners ADD COLUMN IF NOT EXISTS tenant_name TEXT DEFAULT '';

-- Food Coupons for Events
CREATE TABLE IF NOT EXISTS event_food_coupons (
    id SERIAL PRIMARY KEY,
    event_id INTEGER REFERENCES cultural_events(id) ON DELETE CASCADE,
    coupon_type TEXT NOT NULL,
    label TEXT NOT NULL DEFAULT '',
    price NUMERIC(10,2) DEFAULT 0,
    quantity INTEGER DEFAULT 0,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS food_coupon_registrations (
    id SERIAL PRIMARY KEY,
    coupon_id INTEGER REFERENCES event_food_coupons(id) ON DELETE CASCADE,
    flat_no TEXT NOT NULL,
    resident_name TEXT NOT NULL,
    count INTEGER DEFAULT 1,
    amount NUMERIC(10,2) DEFAULT 0,
    status TEXT DEFAULT 'registered',
    phone TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE event_food_coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE food_coupon_registrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read food coupons" ON event_food_coupons FOR SELECT USING (true);
CREATE POLICY "Admin/committee can manage food coupons" ON event_food_coupons FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','committee_member'))
);

CREATE POLICY "Anyone can read coupon registrations" ON food_coupon_registrations FOR SELECT USING (true);
CREATE POLICY "Anyone can insert registrations" ON food_coupon_registrations FOR INSERT WITH CHECK (true);
CREATE POLICY "Admin/committee can manage registrations" ON food_coupon_registrations FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','committee_member'))
);
