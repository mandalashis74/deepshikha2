-- Community Board Replies table

CREATE TABLE IF NOT EXISTS community_replies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID REFERENCES community_posts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id),
    reply_text TEXT NOT NULL,
    owner_flat_no TEXT,
    owner_name TEXT,
    is_anonymous BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE community_replies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read replies" ON community_replies
    FOR SELECT USING (true);

CREATE POLICY "Authenticated users can reply" ON community_replies
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authors can delete own replies" ON community_replies
    FOR DELETE USING (auth.uid() = user_id);
