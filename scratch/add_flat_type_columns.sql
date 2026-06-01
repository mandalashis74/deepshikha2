-- Add flat_types configuration to building_config (comma-separated, like wings)
ALTER TABLE building_config ADD COLUMN IF NOT EXISTS flat_types TEXT DEFAULT '1BHK,2BHK,3BHK';

-- Add flat_type to each owner record
ALTER TABLE owners ADD COLUMN IF NOT EXISTS flat_type TEXT DEFAULT '';
