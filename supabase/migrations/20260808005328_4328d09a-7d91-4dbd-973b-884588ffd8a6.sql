-- Correction of Reception Qualitative KPIs logic:
-- The reception day J starts at 06:00 AM on day J and ends at 06:00 AM on day J+1.
-- If the current time is between 00:00 and 05:59, the "logical" reception day is actually J-1.
-- This ensures that a check at 02:00 AM on 08/08/2026 is seen as the "Nuit" shift of 07/08/2026.

CREATE OR REPLACE FUNCTION public.get_reception_qualitative_kpis(p_target_date date)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    result json;
    v_start_of_day timestamptz;
BEGIN
    -- The reception day starts at 06:00 AM on the given p_target_date
    v_start_of_day := (p_target_date || ' 06:00:00')::timestamp;
    
    WITH periods AS (
        SELECT 'Matin' as period, v_start_of_day as start_t, v_start_of_day + interval '8 hours' as end_t, 1 as sort_order
        UNION ALL
        SELECT 'Après-midi', v_start_of_day + interval '8 hours', v_start_of_day + interval '16 hours', 2
        UNION ALL
        SELECT 'Nuit', v_start_of_day + interval '16 hours', v_start_of_day + interval '24 hours', 3
    ),
    ticket_stats AS (
        SELECT 
            p.period,
            p.sort_order,
            count(rt.id) as tickets_count,
            COALESCE(avg(rt.taux_abattement), 0) as avg_abattement_pct,
            COALESCE(sum(rw.poids_abattement_kg), 0) as total_abattement_kg,
            COALESCE(sum(rw.poids_net_kg), 0) as total_net_kg
        FROM periods p
        LEFT JOIN public.reception_tickets rt ON 
            rt.cloture_at >= p.start_t AND 
            rt.cloture_at < p.end_t AND 
            rt.statut IN ('cloture', 'pese_importe')
        LEFT JOIN public.reception_weighings rw ON rw.ticket_id = rt.id
        GROUP BY p.period, p.sort_order
    )
    SELECT json_agg(
        json_build_object(
            'period_name', period,
            'avg_abattement_pct', avg_abattement_pct,
            'total_abattement_kg', total_abattement_kg,
            'total_net_kg', total_net_kg,
            'tickets_count', tickets_count
        )
        ORDER BY sort_order
    ) INTO result
    FROM ticket_stats;

    RETURN COALESCE(result, '[]'::json);
END;
$$;
