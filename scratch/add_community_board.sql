-- Community Message Board tables

CREATE TABLE IF NOT EXISTS community_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    icon TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO community_categories (name, icon, slug, sort_order) VALUES
    ('Classifieds', 'fa-cart-shopping', 'classifieds', 1),
    ('Recommendations', 'fa-thumbs-up', 'recommendations', 2),
    ('Carpooling', 'fa-car', 'carpooling', 3),
    ('Hobbies & Clubs', 'fa-baseball', 'hobbies', 4)
ON CONFLICT (slug) DO NOTHING;

CREATE TABLE IF NOT EXISTS community_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_slug TEXT NOT NULL REFERENCES community_categories(slug),
    tag TEXT DEFAULT '',
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    price DECIMAL(12,2),
    expiry_date DATE,
    is_anonymous BOOLEAN DEFAULT false,
    status TEXT DEFAULT 'active',
    created_by UUID REFERENCES auth.users(id),
    owner_flat_no TEXT,
    owner_name TEXT,
    upvote_count INT DEFAULT 0,
    reply_count INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS community_upvotes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID REFERENCES community_posts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(post_id, user_id)
);

CREATE TABLE IF NOT EXISTS community_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID REFERENCES community_posts(id) ON DELETE CASCADE,
    reported_by UUID REFERENCES auth.users(id),
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS community_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID REFERENCES community_posts(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    message TEXT DEFAULT '',
    sent_by UUID REFERENCES auth.users(id),
    sent_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE community_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_upvotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active posts" ON community_posts
    FOR SELECT USING (status = 'active' OR status = 'closed');

CREATE POLICY "Authenticated users can create posts" ON community_posts
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authors can update own posts" ON community_posts
    FOR UPDATE USING (auth.uid() = created_by);

CREATE POLICY "Authors can delete own posts" ON community_posts
    FOR DELETE USING (auth.uid() = created_by);

CREATE POLICY "Anyone can read upvotes" ON community_upvotes
    FOR SELECT USING (true);

CREATE POLICY "Authenticated users can upvote" ON community_upvotes
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can remove own upvote" ON community_upvotes
    FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Anyone can read reports" ON community_reports
    FOR SELECT USING (true);

CREATE POLICY "Authenticated users can report" ON community_reports
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Anyone can read community notifications" ON community_notifications
    FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create community notifications" ON community_notifications
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');
