-- Migration: Force calculate cloture_at for all August 8th tickets
DO $$
BEGIN
    -- Bypass the lock trigger using the session setting
    PERFORM set_config('prodintime.bypass_lock', 'on', true);

    UPDATE public.reception_tickets
    SET cloture_at = (date_ticket || ' ' || COALESCE(heure_fin, heure_debut, '12:00:00'))::timestamp AT TIME ZONE 'UTC'
    WHERE date_ticket = '2026-08-08'
      AND cloture_at IS NULL
      AND statut = 'pese_importe';

    UPDATE public.reception_tickets
    SET cloture_at = (date_ticket || ' ' || COALESCE(heure_fin, heure_debut, '12:00:00'))::timestamp AT TIME ZONE 'UTC'
    WHERE date_ticket = '2026-08-07'
      AND cloture_at IS NULL
      AND statut = 'pese_importe';

    -- Reset the config just in case, though it's local to the transaction
    PERFORM set_config('prodintime.bypass_lock', 'off', true);
END $$;

CREATE OR REPLACE FUNCTION public.get_reception_qualitative_kpis(p_target_date date)
 RETURNS json
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
 DECLARE
     result json;
     v_start_of_day timestamptz;
 BEGIN
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
             'avg_abattement_pct', ROUND(avg_abattement_pct::numeric, 2),
             'total_abattement_kg', ROUND(total_abattement_kg::numeric, 2),
             'total_net_kg', ROUND(total_net_kg::numeric, 2),
             'tickets_count', tickets_count
         ) ORDER BY sort_order
     ) INTO result
     FROM ticket_stats;

     RETURN COALESCE(result, '[]'::json);
 END;
 $function$;