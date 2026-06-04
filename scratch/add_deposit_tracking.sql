ALTER TABLE income ADD COLUMN IF NOT EXISTS deposit_status TEXT DEFAULT 'pending_deposit';
ALTER TABLE income ADD COLUMN IF NOT EXISTS deposited_by TEXT;
ALTER TABLE income ADD COLUMN IF NOT EXISTS deposited_at TIMESTAMPTZ;

-- Track deposits in a separate table for audit
CREATE TABLE IF NOT EXISTS deposit_log (
    id BIGSERIAL PRIMARY KEY,
    income_id BIGINT REFERENCES income(id),
    deposited_by TEXT NOT NULL,
    deposited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    amount DECIMAL(12,2) NOT NULL,
    notes TEXT
);

ALTER TABLE deposit_log ENABLE ROW LEVEL SECURITY;
ALTER PUBLICATION supabase_realtime ADD TABLE deposit_log;
