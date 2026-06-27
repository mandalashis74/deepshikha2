-- Add treasurer acknowledgement columns to income table
ALTER TABLE income ADD COLUMN IF NOT EXISTS acknowledgement_status TEXT;
ALTER TABLE income ADD COLUMN IF NOT EXISTS acknowledged_by TEXT;
ALTER TABLE income ADD COLUMN IF NOT EXISTS acknowledged_at TEXT;
