-- Committee Management System
-- Phase 1: Committee Positions & Members

CREATE TABLE IF NOT EXISTS committee_positions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    category TEXT NOT NULL DEFAULT 'executive' CHECK (category IN ('executive', 'subcommittee')),
    description TEXT DEFAULT '',
    permissions_override JSONB NOT NULL DEFAULT '[]'::jsonb,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS committee_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    position_id UUID REFERENCES committee_positions(id) ON DELETE CASCADE,
    flat_no TEXT,
    owner_name TEXT DEFAULT '',
    term_start DATE NOT NULL DEFAULT CURRENT_DATE,
    term_end DATE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(position_id, user_id)
);

-- Seed default positions
INSERT INTO committee_positions (title, slug, category, description, permissions_override, sort_order) VALUES
    ('President', 'president', 'executive',
     'Overall head of the managing committee. Can approve high-value expenses, sign legal notices, access all modules.',
     '["expense:approve","expense:delete","income:delete","committee:manage","documents:view_all","documents:upload","reports:view_all"]',
     1),
    ('Secretary', 'secretary', 'executive',
     'Handles official correspondence, maintains meeting minutes, manages legal documents and notices.',
     '["committee:view","documents:upload","documents:delete","meetings:manage","resolutions:manage","tickets:assign"]',
     2),
    ('Treasurer', 'treasurer', 'executive',
     'Manages society finances, bank details, payment approvals, and financial reporting.',
     '["expense:approve","income:delete","reports:view_all","history:view","documents:view_all"]',
     3),
    ('Cultural Committee Head', 'cultural_head', 'subcommittee',
     'Manages cultural events, competitions, and community gatherings.',
     '["events:create","events:delete","events:manage_vendors","events:manage_competitions","events:upload_gallery"]',
     4),
    ('Maintenance Lead', 'maintenance_lead', 'subcommittee',
     'Oversees building maintenance, vendor contracts, and helpdesk ticket resolution.',
     '["tickets:assign","tickets:resolve","tickets:close","expense:create","committee:view"]',
     5),
    ('Security Lead', 'security_lead', 'subcommittee',
     'Manages security protocols, gate access, and visitor policies.',
     '["committee:view","tickets:assign","tickets:resolve"]',
     6)
ON CONFLICT (slug) DO NOTHING;

ALTER TABLE committee_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view committee members" ON committee_members
    FOR SELECT USING (true);

CREATE POLICY "Only admins can manage committee members" ON committee_members
    FOR ALL USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );
