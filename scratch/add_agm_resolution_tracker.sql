-- AGM & Resolution Tracker
-- Phase 2: Meetings, Resolutions, Attendance, Acknowledgments

CREATE TABLE IF NOT EXISTS meetings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'AGM' CHECK (type IN ('AGM', 'SGM', 'other')),
    description TEXT DEFAULT '',
    meeting_date DATE NOT NULL,
    agenda_url TEXT DEFAULT '',
    minutes_url TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'ongoing', 'completed', 'cancelled')),
    quorum_required INT DEFAULT 0,
    quorum_met INT DEFAULT 0,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS resolutions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_id UUID REFERENCES meetings(id) ON DELETE CASCADE,
    resolution_number TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    category TEXT DEFAULT 'general',
    status TEXT NOT NULL DEFAULT 'passed' CHECK (status IN ('proposed', 'passed', 'rejected')),
    passed_date DATE,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS meeting_attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_id UUID REFERENCES meetings(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id),
    flat_no TEXT,
    checked_in_at TIMESTAMPTZ DEFAULT now(),
    is_proxy BOOLEAN DEFAULT false,
    proxy_for UUID REFERENCES auth.users(id),
    UNIQUE(meeting_id, user_id)
);

CREATE TABLE IF NOT EXISTS meeting_acknowledgments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_id UUID REFERENCES meetings(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id),
    acknowledged_at TIMESTAMPTZ DEFAULT now(),
    has_flag BOOLEAN DEFAULT false,
    flag_reason TEXT DEFAULT '',
    UNIQUE(meeting_id, user_id)
);

ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE resolutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_acknowledgments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read meetings" ON meetings FOR SELECT USING (true);
CREATE POLICY "Authenticated can insert meetings" ON meetings FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Creators can update meetings" ON meetings FOR UPDATE USING (auth.uid() = created_by OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Anyone can read resolutions" ON resolutions FOR SELECT USING (true);
CREATE POLICY "Authenticated can insert resolutions" ON resolutions FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Creators can update resolutions" ON resolutions FOR UPDATE USING (auth.uid() = created_by OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Anyone can read attendance" ON meeting_attendance FOR SELECT USING (true);
CREATE POLICY "Users can check in" ON meeting_attendance FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Anyone can read acknowledgments" ON meeting_acknowledgments FOR SELECT USING (true);
CREATE POLICY "Users can acknowledge" ON meeting_acknowledgments FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Users can update own acknowledgment" ON meeting_acknowledgments FOR UPDATE USING (auth.uid() = user_id);
