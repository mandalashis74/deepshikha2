-- Building configuration table for multi-building support
CREATE TABLE IF NOT EXISTS building_config (
    id INTEGER PRIMARY KEY DEFAULT 1,
    building_name TEXT DEFAULT 'My Residency',
    block_name TEXT DEFAULT '',
    address TEXT DEFAULT '',
    floors INTEGER DEFAULT 8,
    wings TEXT DEFAULT 'A,B,C,D,E,F,G,H',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Insert default config
INSERT INTO building_config (id, building_name, block_name, floors, wings)
VALUES (1, 'My Residency', '', 8, 'A,B,C,D,E,F,G,H')
ON CONFLICT (id) DO NOTHING;
