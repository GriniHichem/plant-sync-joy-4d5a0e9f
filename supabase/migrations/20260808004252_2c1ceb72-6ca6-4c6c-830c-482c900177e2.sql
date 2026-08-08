-- New migration for Global Reception Qualitative KPIs
-- Created at 2026-08-08 00:45 UTC

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
    -- The reception day starts at 06:00 AM on the given date
    v_start_of_day := (p_target_date || ' 06:00:00')::timestamptz;
    
    WITH periods AS (
        SELECT 'Matin' as period, v_start_of_day as start_t, v_start_of_day + interval '8 hours' as end_t
        UNION ALL
        SELECT 'Après-midi', v_start_of_day + interval '8 hours', v_start_of_day + interval '16 hours'
        UNION ALL
        SELECT 'Nuit', v_start_of_day + interval '16 hours', v_start_of_day + interval '24 hours'
    ),
    ticket_stats AS (
        SELECT 
            p.period,
            count(rt.id) as tickets_count,
            COALESCE(avg(rt.taux_abattement), 0) as avg_abattement_pct,
            COALESCE(sum(rw.poids_abattement_kg), 0) as total_abattement_kg,
            COALESCE(sum(rw.poids_net_kg), 0) as total_net_kg
        FROM periods p
        LEFT JOIN public.reception_tickets rt ON rt.cloture_at >= p.start_t AND rt.cloture_at < p.end_t AND rt.statut IN ('cloture', 'pese_importe')
        LEFT JOIN public.reception_weighings rw ON rw.ticket_id = rt.id
        GROUP BY p.period
    )
    SELECT json_agg(
        json_build_object(
            'period_name', period,
            'avg_abattement_pct', avg_abattement_pct,
            'total_abattement_kg', total_abattement_kg,
            'total_net_kg', total_net_kg,
            'tickets_count', tickets_count
        )
    ) INTO result
    FROM (
        -- Ensure order: Matin, Après-midi, Nuit
        SELECT * FROM ticket_stats WHERE period = 'Matin'
        UNION ALL
        SELECT * FROM ticket_stats WHERE period = 'Après-midi'
        UNION ALL
        SELECT * FROM ticket_stats WHERE period = 'Nuit'
    ) ordered_stats;

    RETURN COALESCE(result, '[]'::json);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_reception_qualitative_kpis(date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_reception_qualitative_kpis(date) TO service_role;
