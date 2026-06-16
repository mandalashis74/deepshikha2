-- Track occupancy history per flat for proper billing when ownership changes

CREATE TABLE IF NOT EXISTS occupancy_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    flat_no TEXT NOT NULL,
    owner_name TEXT DEFAULT '',
    occupancy_type TEXT NOT NULL CHECK (occupancy_type IN ('owner', 'tenant')),
    occupancy_from DATE NOT NULL,
    occupancy_to DATE DEFAULT NULL,
    notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_occupancy_history_flat_no ON occupancy_history(flat_no);

ALTER TABLE occupancy_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read occupancy_history" ON occupancy_history;
CREATE POLICY "Anyone can read occupancy_history" ON occupancy_history
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admin can manage occupancy_history" ON occupancy_history;
CREATE POLICY "Admin can manage occupancy_history" ON occupancy_history
    FOR ALL TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- Migrate existing occupancy data from owners table
INSERT INTO occupancy_history (flat_no, owner_name, occupancy_type, occupancy_from, occupancy_to)
SELECT 
    flat_no,
    owner_name,
    CASE WHEN occupancy_status = 'tenant-occupied' THEN 'tenant' ELSE 'owner' END,
    occupancy_from,
    occupancy_to
FROM owners
WHERE (occupancy_from IS NOT NULL OR occupancy_to IS NOT NULL)
  AND occupancy_status IS NOT NULL
  AND occupancy_status != 'vacant'
  AND NOT EXISTS (SELECT 1 FROM occupancy_history oh WHERE oh.flat_no = owners.flat_no LIMIT 1);
