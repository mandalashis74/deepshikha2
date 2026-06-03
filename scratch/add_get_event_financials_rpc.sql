-- RPC function to get aggregated financials for a cultural event
CREATE OR REPLACE FUNCTION get_event_financials(p_event_id INTEGER)
RETURNS TABLE(total_collected NUMERIC, total_spent NUMERIC)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        COALESCE((SELECT SUM(amount) FROM income WHERE category = 'Cultural Event' AND event_id = p_event_id), 0) AS total_collected,
        COALESCE((SELECT SUM(amount) FROM event_expenses WHERE event_id = p_event_id), 0) AS total_spent;
END;
$$;
