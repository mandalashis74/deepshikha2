-- Backfill effective_to for existing maintenance_rates
-- For each flat_type, sets effective_to = next rate's effective_from - 1 day
-- Only for rates that don't already have effective_to set
WITH ranked AS (
    SELECT
        id,
        flat_type,
        effective_from,
        LEAD(effective_from) OVER (PARTITION BY flat_type ORDER BY effective_from) AS next_effective_from
    FROM maintenance_rates
)
UPDATE maintenance_rates m
SET effective_to = (r.next_effective_from::date - INTERVAL '1 day')::date,
    is_active = false
FROM ranked r
WHERE m.id = r.id
  AND r.next_effective_from IS NOT NULL
  AND m.effective_to IS NULL;
