-- Update existing roles with new Cultural Events permissions
-- Run this if your roles table already has data from setup_roles_table.sql

UPDATE roles SET permissions = permissions || '["events:view","events:create","events:delete","events:contribute","events:perform","events:manage_vendors","events:manage_competitions","events:vote","events:score","events:upload_gallery","events:generate_passes"]'::jsonb
WHERE name = 'admin' AND NOT (permissions ? 'events:view');
