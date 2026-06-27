-- Mark all income records as deposited and acknowledged, except June 2026
UPDATE income
SET
    deposit_status = 'deposited',
    deposited_by = 'System',
    deposited_at = '2026-06-27T12:00:00.000Z',
    acknowledgement_status = 'acknowledged',
    acknowledged_by = 'System',
    acknowledged_at = '2026-06-27T12:00:00.000Z'
WHERE NOT (month = 'June' AND year = '2026');
