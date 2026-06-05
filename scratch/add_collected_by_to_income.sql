ALTER TABLE income ADD COLUMN IF NOT EXISTS collected_by TEXT DEFAULT '';

UPDATE income SET collected_by = '' WHERE collected_by IS NULL;
