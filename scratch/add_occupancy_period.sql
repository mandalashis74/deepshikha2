-- Add occupancy period columns to owners table
ALTER TABLE owners ADD COLUMN IF NOT EXISTS occupancy_from DATE;
ALTER TABLE owners ADD COLUMN IF NOT EXISTS occupancy_to DATE;
