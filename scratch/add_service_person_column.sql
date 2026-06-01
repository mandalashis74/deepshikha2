-- Add new columns to owners table
ALTER TABLE owners ADD COLUMN IF NOT EXISTS service_person TEXT DEFAULT '';
ALTER TABLE owners ADD COLUMN IF NOT EXISTS vehicle_details TEXT DEFAULT '';
