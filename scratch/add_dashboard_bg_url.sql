-- Add dashboard background image URL to building_config
ALTER TABLE building_config ADD COLUMN IF NOT EXISTS dashboard_bg_url TEXT DEFAULT '';
