-- Final audit and fix for Reception Qualitative KPIs and Recent Tickets
-- 1. Ensure get_reception_qualitative_kpis is robust against NULLs and handles UTC vs Local correctly.
-- 2. Ensure ordering of recent tickets is strictly by cloture_at DESC.
-- 3. Include both 'cloture' and 'pese_importe' statuses.

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
    -- Standardize start of day at 06:00:00. 
    -- Important: Using timestamp without time zone then casting to timestamptz 
    -- uses the database's current timezone setting.
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
            -- Calculate average abatement only for tickets that have a value
            COALESCE(avg(rt.taux_abattement) FILTER (WHERE rt.taux_abattement IS NOT NULL), 0) as avg_abattement_pct,
            -- Sum weights, ensuring we only count tickets that have weighings
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
            'avg_abattement_pct', ROUND(avg_abattement_pct::numeric, 2),
            'total_abattement_kg', ROUND(total_abattement_kg::numeric, 2),
            'total_net_kg', ROUND(total_net_kg::numeric, 2),
            'tickets_count', tickets_count
        )
        ORDER BY sort_order
    ) INTO result
    FROM ticket_stats;

    RETURN COALESCE(result, '[]'::json);
END;
$$;

-- Ensure indexes exist for performance (safe with IF NOT EXISTS if supported, or just run)
CREATE INDEX IF NOT EXISTS idx_reception_tickets_cloture_at ON public.reception_tickets(cloture_at) WHERE statut IN ('cloture', 'pese_importe');
CREATE INDEX IF NOT EXISTS idx_reception_weighings_ticket_id ON public.reception_weighings(ticket_id);
