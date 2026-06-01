-- Event Volunteers table
CREATE TABLE IF NOT EXISTS event_volunteers (
    id SERIAL PRIMARY KEY,
    event_id INTEGER REFERENCES cultural_events(id) ON DELETE CASCADE,
    flat_no TEXT NOT NULL,
    volunteer_name TEXT NOT NULL,
    contact TEXT DEFAULT '',
    role_preference TEXT DEFAULT '',
    availability TEXT DEFAULT '',
    status TEXT DEFAULT 'registered' CHECK (status IN ('registered','confirmed','cancelled')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Event Expenses table (for transparency board)
CREATE TABLE IF NOT EXISTS event_expenses (
    id SERIAL PRIMARY KEY,
    event_id INTEGER REFERENCES cultural_events(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    amount NUMERIC(10,2) DEFAULT 0,
    category TEXT DEFAULT 'other',
    vendor_name TEXT DEFAULT '',
    invoice_url TEXT DEFAULT '',
    added_by TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE event_volunteers ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to read volunteers" ON event_volunteers
    FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated users to insert volunteers" ON event_volunteers
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Allow admin full access volunteers" ON event_volunteers
    FOR ALL USING (
        EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
    );

CREATE POLICY "Allow authenticated users to read event_expenses" ON event_expenses
    FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow admin full access event_expenses" ON event_expenses
    FOR ALL USING (
        EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
    );
