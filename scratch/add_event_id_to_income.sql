-- Add event_id column to income table for direct event linking
ALTER TABLE income ADD COLUMN IF NOT EXISTS event_id INTEGER REFERENCES cultural_events(id) ON DELETE SET NULL;
