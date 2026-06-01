-- Cultural Events Module Schema
-- Run this in your Supabase SQL Editor

-- 1. Main events table
CREATE TABLE IF NOT EXISTS cultural_events (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    banner_url TEXT DEFAULT '',
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    contribution_amount NUMERIC(10,2) DEFAULT 0,
    target_amount NUMERIC(12,2) DEFAULT 0,
    status TEXT DEFAULT 'upcoming' CHECK (status IN ('upcoming','active','ongoing','completed')),
    committee_notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Event schedule/timeline
CREATE TABLE IF NOT EXISTS event_schedules (
    id SERIAL PRIMARY KEY,
    event_id INTEGER REFERENCES cultural_events(id) ON DELETE CASCADE,
    day_label TEXT NOT NULL,
    time_from TIME,
    time_to TIME,
    activity TEXT NOT NULL,
    location TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    sort_order INTEGER DEFAULT 0
);

-- 3. Performance/talent registrations
CREATE TABLE IF NOT EXISTS event_performances (
    id SERIAL PRIMARY KEY,
    event_id INTEGER REFERENCES cultural_events(id) ON DELETE CASCADE,
    flat_no TEXT NOT NULL,
    performer_name TEXT NOT NULL,
    performance_type TEXT DEFAULT 'dance',
    audio_url TEXT DEFAULT '',
    requirements TEXT DEFAULT '',
    status TEXT DEFAULT 'registered' CHECK (status IN ('registered','auditioned','confirmed','completed','cancelled')),
    slot_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Vendor/stall bookings
CREATE TABLE IF NOT EXISTS event_vendors (
    id SERIAL PRIMARY KEY,
    event_id INTEGER REFERENCES cultural_events(id) ON DELETE CASCADE,
    vendor_name TEXT NOT NULL,
    stall_no TEXT DEFAULT '',
    category TEXT DEFAULT 'food',
    amount NUMERIC(10,2) DEFAULT 0,
    contact TEXT DEFAULT '',
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending','confirmed','cancelled')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Competition categories
CREATE TABLE IF NOT EXISTS event_competitions (
    id SERIAL PRIMARY KEY,
    event_id INTEGER REFERENCES cultural_events(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    judge_type TEXT DEFAULT 'residents' CHECK (judge_type IN ('residents','judges','both')),
    max_score NUMERIC(5,2) DEFAULT 10,
    status TEXT DEFAULT 'open' CHECK (status IN ('open','closed','declared'))
);

-- 6. Competition judges
CREATE TABLE IF NOT EXISTS event_judges (
    id SERIAL PRIMARY KEY,
    competition_id INTEGER REFERENCES event_competitions(id) ON DELETE CASCADE,
    judge_name TEXT NOT NULL,
    contact TEXT DEFAULT ''
);

-- 7. Competition scores (judged)
CREATE TABLE IF NOT EXISTS event_scores (
    id SERIAL PRIMARY KEY,
    competition_id INTEGER REFERENCES event_competitions(id) ON DELETE CASCADE,
    judge_id INTEGER REFERENCES event_judges(id) ON DELETE CASCADE,
    participant_flat TEXT NOT NULL,
    participant_name TEXT NOT NULL,
    score NUMERIC(5,2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(competition_id, judge_id, participant_flat)
);

-- 8. Resident votes (for public-voted competitions)
CREATE TABLE IF NOT EXISTS event_votes (
    id SERIAL PRIMARY KEY,
    competition_id INTEGER REFERENCES event_competitions(id) ON DELETE CASCADE,
    nominee_flat TEXT NOT NULL,
    voter_flat TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(competition_id, voter_flat)
);

-- 9. Event gallery/media
CREATE TABLE IF NOT EXISTS event_gallery (
    id SERIAL PRIMARY KEY,
    event_id INTEGER REFERENCES cultural_events(id) ON DELETE CASCADE,
    uploaded_by TEXT NOT NULL,
    image_url TEXT NOT NULL,
    caption TEXT DEFAULT '',
    folder TEXT DEFAULT 'general',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Event visitor passes (for security gate)
CREATE TABLE IF NOT EXISTS event_visitor_passes (
    id SERIAL PRIMARY KEY,
    event_id INTEGER REFERENCES cultural_events(id) ON DELETE CASCADE,
    flat_no TEXT NOT NULL,
    guest_name TEXT NOT NULL,
    guest_contact TEXT DEFAULT '',
    pass_date DATE NOT NULL,
    status TEXT DEFAULT 'active' CHECK (status IN ('active','used','expired')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on all tables
ALTER TABLE cultural_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_performances ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_competitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_judges ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_gallery ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_visitor_passes ENABLE ROW LEVEL SECURITY;

-- RLS policies: allow authenticated users to read all event data
DROP POLICY IF EXISTS "Allow authenticated users to read events" ON cultural_events;
CREATE POLICY "Allow authenticated users to read events" ON cultural_events
    FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Allow authenticated users to read schedules" ON event_schedules;
CREATE POLICY "Allow authenticated users to read schedules" ON event_schedules
    FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Allow authenticated users to read performances" ON event_performances;
CREATE POLICY "Allow authenticated users to read performances" ON event_performances
    FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Allow authenticated users to read vendors" ON event_vendors;
CREATE POLICY "Allow authenticated users to read vendors" ON event_vendors
    FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Allow authenticated users to read competitions" ON event_competitions;
CREATE POLICY "Allow authenticated users to read competitions" ON event_competitions
    FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Allow authenticated users to read judges" ON event_judges;
CREATE POLICY "Allow authenticated users to read judges" ON event_judges
    FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Allow authenticated users to read scores" ON event_scores;
CREATE POLICY "Allow authenticated users to read scores" ON event_scores
    FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Allow authenticated users to read votes" ON event_votes;
CREATE POLICY "Allow authenticated users to read votes" ON event_votes
    FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Allow authenticated users to read gallery" ON event_gallery;
CREATE POLICY "Allow authenticated users to read gallery" ON event_gallery
    FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Allow authenticated users to read passes" ON event_visitor_passes;
CREATE POLICY "Allow authenticated users to read passes" ON event_visitor_passes
    FOR SELECT USING (auth.role() = 'authenticated');

-- Allow admin writes
DROP POLICY IF EXISTS "Allow admin insert/update/delete events" ON cultural_events;
CREATE POLICY "Allow admin insert/update/delete events" ON cultural_events
    FOR ALL USING (
        EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
    );
DROP POLICY IF EXISTS "Allow admin insert/update/delete schedules" ON event_schedules;
CREATE POLICY "Allow admin insert/update/delete schedules" ON event_schedules
    FOR ALL USING (
        EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
    );
DROP POLICY IF EXISTS "Allow admin insert/update/delete vendors" ON event_vendors;
CREATE POLICY "Allow admin insert/update/delete vendors" ON event_vendors
    FOR ALL USING (
        EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
    );
DROP POLICY IF EXISTS "Allow admin insert/update/delete competitions" ON event_competitions;
CREATE POLICY "Allow admin insert/update/delete competitions" ON event_competitions
    FOR ALL USING (
        EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
    );
DROP POLICY IF EXISTS "Allow admin insert/update/delete judges" ON event_judges;
CREATE POLICY "Allow admin insert/update/delete judges" ON event_judges
    FOR ALL USING (
        EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
    );
DROP POLICY IF EXISTS "Allow admin insert/update/delete gallery" ON event_gallery;
CREATE POLICY "Allow admin insert/update/delete gallery" ON event_gallery
    FOR ALL USING (
        EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
    );
DROP POLICY IF EXISTS "Allow admin insert/update/delete performances" ON event_performances;
CREATE POLICY "Allow admin insert/update/delete performances" ON event_performances
    FOR ALL USING (
        EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
    );

-- Allow authenticated users to insert their own performances, votes, passes
DROP POLICY IF EXISTS "Allow authenticated insert performances" ON event_performances;
CREATE POLICY "Allow authenticated insert performances" ON event_performances
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Allow authenticated update own performances" ON event_performances;
CREATE POLICY "Allow authenticated update own performances" ON event_performances
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid())
    );
DROP POLICY IF EXISTS "Allow authenticated insert votes" ON event_votes;
CREATE POLICY "Allow authenticated insert votes" ON event_votes
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Allow authenticated insert passes" ON event_visitor_passes;
CREATE POLICY "Allow authenticated insert passes" ON event_visitor_passes
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Allow authenticated insert gallery" ON event_gallery;
CREATE POLICY "Allow authenticated insert gallery" ON event_gallery
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');
