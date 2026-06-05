-- Add flat naming scheme columns to building_config table
ALTER TABLE building_config ADD COLUMN IF NOT EXISTS flat_include_block BOOLEAN DEFAULT FALSE;
ALTER TABLE building_config ADD COLUMN IF NOT EXISTS flat_include_wing BOOLEAN DEFAULT FALSE;
ALTER TABLE building_config ADD COLUMN IF NOT EXISTS flat_include_floor BOOLEAN DEFAULT TRUE;
ALTER TABLE building_config ADD COLUMN IF NOT EXISTS flat_include_wing_letter BOOLEAN DEFAULT TRUE;
ALTER TABLE building_config ADD COLUMN IF NOT EXISTS flat_delimiter TEXT DEFAULT '';
ALTER TABLE building_config ADD COLUMN IF NOT EXISTS flat_exceptions TEXT DEFAULT '';
