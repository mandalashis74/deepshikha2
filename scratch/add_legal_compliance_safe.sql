-- Legal & Compliance Safe
-- Phase 3: Document Vault + Compliance Calendar

-- Ensure storage bucket exists (run in Supabase Dashboard Storage or via SQL)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('documents', 'documents', false) ON CONFLICT (id) DO NOTHING;

-- 1. Document Vault
CREATE TABLE IF NOT EXISTS document_vault (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    category TEXT NOT NULL DEFAULT 'general',
    file_url TEXT NOT NULL,
    file_size BIGINT DEFAULT 0,
    file_type TEXT DEFAULT '',
    version INTEGER DEFAULT 1,
    tags TEXT[] DEFAULT '{}',
    uploaded_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Compliance Calendar
CREATE TABLE IF NOT EXISTS compliance_calendar (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    category TEXT NOT NULL DEFAULT 'general',
    due_date DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','completed','overdue','waived')),
    assigned_to UUID REFERENCES auth.users(id),
    completed_at TIMESTAMPTZ,
    completed_by UUID REFERENCES auth.users(id),
    recurring BOOLEAN DEFAULT false,
    recurrence_pattern TEXT DEFAULT '',
    reminder_days INTEGER DEFAULT 7,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE document_vault ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_calendar ENABLE ROW LEVEL SECURITY;

-- Document Vault policies
CREATE POLICY "Anyone can read documents" ON document_vault FOR SELECT USING (true);
CREATE POLICY "Admin/committee can upload documents" ON document_vault FOR INSERT WITH CHECK (
    auth.role() = 'authenticated'
);
CREATE POLICY "Admin/committee can update documents" ON document_vault FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'committee_member'))
);
CREATE POLICY "Only admin can delete documents" ON document_vault FOR DELETE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Compliance Calendar policies
CREATE POLICY "Anyone can view compliance events" ON compliance_calendar FOR SELECT USING (true);
CREATE POLICY "Admin/committee can create compliance events" ON compliance_calendar FOR INSERT WITH CHECK (
    auth.role() = 'authenticated'
);
CREATE POLICY "Admin/committee can update compliance events" ON compliance_calendar FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'committee_member'))
);
CREATE POLICY "Only admin can delete compliance events" ON compliance_calendar FOR DELETE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
