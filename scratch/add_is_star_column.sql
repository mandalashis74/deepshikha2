-- Add is_star column to event_performances for tagging star performers
ALTER TABLE event_performances ADD COLUMN IF NOT EXISTS is_star BOOLEAN DEFAULT FALSE;
