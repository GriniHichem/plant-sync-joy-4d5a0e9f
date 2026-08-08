-- Ensure get_reception_qualitative_kpis returns consistent numbers even if no data exists
-- And fix any missing cloture_at for imported tickets

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
    -- Force UTC for consistent logical day boundaries
    v_start_of_day := (p_target_date || ' 06:00:00')::timestamp AT TIME ZONE 'UTC';
    
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
            COALESCE(avg(rt.taux_abattement) FILTER (WHERE rt.taux_abattement IS NOT NULL), 0) as avg_abattement_pct,
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
            'avg_abattement_pct', ROUND(COALESCE(avg_abattement_pct, 0)::numeric, 2),
            'total_abattement_kg', ROUND(COALESCE(total_abattement_kg, 0)::numeric, 2),
            'total_net_kg', ROUND(COALESCE(total_net_kg, 0)::numeric, 2),
            'tickets_count', COALESCE(tickets_count, 0)
        )
        ORDER BY sort_order
    ) INTO result
    FROM ticket_stats;

    -- Return an empty array structure with zeros if nothing was found
    IF result IS NULL THEN
        RETURN '[
            {"period_name": "Matin", "avg_abattement_pct": 0, "total_abattement_kg": 0, "total_net_kg": 0, "tickets_count": 0},
            {"period_name": "Après-midi", "avg_abattement_pct": 0, "total_abattement_kg": 0, "total_net_kg": 0, "tickets_count": 0},
            {"period_name": "Nuit", "avg_abattement_pct": 0, "total_abattement_kg": 0, "total_net_kg": 0, "tickets_count": 0}
        ]'::json;
    END IF;

    RETURN result;
END;
$$;
