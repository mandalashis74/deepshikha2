-- Add Google Drive API credential columns to building_config
ALTER TABLE building_config ADD COLUMN IF NOT EXISTS google_api_key TEXT DEFAULT '';
ALTER TABLE building_config ADD COLUMN IF NOT EXISTS google_client_id TEXT DEFAULT '';
