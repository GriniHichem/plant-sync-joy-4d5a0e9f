-- Forcing drop to ensure return types can be updated
DROP FUNCTION IF EXISTS public.get_reception_user_kpis(uuid, timestamp without time zone, timestamp without time zone);
DROP FUNCTION IF EXISTS public.reception_global_stats(timestamp without time zone, timestamp without time zone);

-- Recreating get_reception_user_kpis
CREATE OR REPLACE FUNCTION public.get_reception_user_kpis(_user_id uuid, _start_date timestamp without time zone, _end_date timestamp without time zone)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
    result json;
BEGIN
    SELECT json_build_object(
        'count_pese', (
            SELECT count(*) 
            FROM public.reception_tickets 
            WHERE (created_by = _user_id OR cloture_by = _user_id)
              AND created_at BETWEEN _start_date AND _end_date
              AND etat_pesee IN ('pese', 'pese_importe')
        ),
        'count_a_peser', (
            SELECT count(*) 
            FROM public.reception_tickets 
            WHERE (created_by = _user_id OR cloture_by = _user_id)
              AND created_at BETWEEN _start_date AND _end_date
              AND etat_pesee = 'a_peser'
        ),
        'avg_abattement', COALESCE((
            SELECT avg(taux_abattement) 
            FROM public.reception_tickets 
            WHERE (created_by = _user_id OR cloture_by = _user_id)
              AND created_at BETWEEN _start_date AND _end_date
              AND taux_abattement IS NOT NULL
        ), 0),
        'avg_duree', COALESCE((
            SELECT avg(EXTRACT(EPOCH FROM (cloture_at - created_at)) / 60)
            FROM public.reception_tickets 
            WHERE (created_by = _user_id OR cloture_by = _user_id)
              AND created_at BETWEEN _start_date AND _end_date
              AND cloture_at IS NOT NULL
        ), 0)
    ) INTO result;
    
    RETURN result;
END;
$$;

-- Recreating reception_global_stats
CREATE OR REPLACE FUNCTION public.reception_global_stats(_start_date timestamp without time zone, _end_date timestamp without time zone)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
    result json;
BEGIN
    SELECT json_build_object(
        'total_tickets', count(*),
        'a_peser', count(*) FILTER (WHERE etat_pesee = 'a_peser'),
        'pese', count(*) FILTER (WHERE etat_pesee IN ('pese', 'pese_importe')),
        'total_net', COALESCE(sum(poids_net_kg), 0),
        'moy_abattement', COALESCE(avg(taux_abattement), 0),
        'moy_duree', COALESCE(avg(EXTRACT(EPOCH FROM (cloture_at - created_at)) / 60), 0)
    )
    FROM public.v_reception_global
    WHERE created_at BETWEEN _start_date AND _end_date
    INTO result;
    
    RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_reception_user_kpis(uuid, timestamp without time zone, timestamp without time zone) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reception_global_stats(timestamp without time zone, timestamp without time zone) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_reception_user_kpis(uuid, timestamp without time zone, timestamp without time zone) TO service_role;
GRANT EXECUTE ON FUNCTION public.reception_global_stats(timestamp without time zone, timestamp without time zone) TO service_role;
