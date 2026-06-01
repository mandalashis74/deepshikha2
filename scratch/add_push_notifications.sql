-- Push notification subscriptions
CREATE TABLE IF NOT EXISTS push_subscriptions (
    id SERIAL PRIMARY KEY,
    flat_no TEXT NOT NULL,
    endpoint TEXT NOT NULL UNIQUE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    user_agent TEXT DEFAULT '',
    subscribed_at TIMESTAMPTZ DEFAULT NOW(),
    last_active TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can manage their own subscriptions
CREATE POLICY "Users can read own subscriptions" ON push_subscriptions
    FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Users can insert own subscriptions" ON push_subscriptions
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Users can delete own subscriptions" ON push_subscriptions
    FOR DELETE USING (auth.role() = 'authenticated');
CREATE POLICY "Admin can read all" ON push_subscriptions
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
    );
CREATE POLICY "Admin can delete stale" ON push_subscriptions
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
    );

-- VAPID keys in building_config
ALTER TABLE building_config ADD COLUMN IF NOT EXISTS vapid_public_key TEXT DEFAULT '';
ALTER TABLE building_config ADD COLUMN IF NOT EXISTS vapid_private_key TEXT DEFAULT '';

-- Notification history
CREATE TABLE IF NOT EXISTS event_notifications (
    id SERIAL PRIMARY KEY,
    event_id INTEGER REFERENCES cultural_events(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    message TEXT DEFAULT '',
    sent_at TIMESTAMPTZ DEFAULT NOW(),
    sent_by TEXT DEFAULT ''
);

ALTER TABLE event_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access notifications" ON event_notifications
    FOR ALL USING (
        EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
    );
CREATE POLICY "Users can read notifications" ON event_notifications
    FOR SELECT USING (auth.role() = 'authenticated');
