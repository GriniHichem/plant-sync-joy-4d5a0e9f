-- Suppression des fonctions existantes (toutes les signatures possibles pour éviter les conflits)
DROP FUNCTION IF EXISTS public.get_reception_user_kpis(uuid, timestamp without time zone, timestamp without time zone);
DROP FUNCTION IF EXISTS public.get_reception_user_kpis(uuid, timestamp with time zone, timestamp with time zone);
DROP FUNCTION IF EXISTS public.reception_global_stats(timestamp without time zone, timestamp without time zone);
DROP FUNCTION IF EXISTS public.reception_global_stats(timestamp with time zone, timestamp with time zone);

-- RPC: get_reception_user_kpis (avec Timestamptz)
CREATE OR REPLACE FUNCTION public.get_reception_user_kpis(
    p_user_id uuid, 
    p_start_time timestamp with time zone, 
    p_end_time timestamp with time zone
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    result json;
BEGIN
    SELECT json_build_object(
        'count_pese', (
            SELECT count(*)
            FROM public.reception_tickets
            WHERE (created_by = p_user_id OR cloture_by = p_user_id)
              AND created_at >= p_start_time AND created_at < p_end_time
              AND etat_pesee IN ('pese', 'pese_importe')
        ),
        'count_a_peser', (
            SELECT count(*)
            FROM public.reception_tickets
            WHERE (created_by = p_user_id OR cloture_by = p_user_id)
              AND created_at >= p_start_time AND created_at < p_end_time
              AND etat_pesee = 'a_peser'
        ),
        'avg_abattement', COALESCE((
            SELECT avg(taux_abattement)
            FROM public.reception_tickets
            WHERE (created_by = p_user_id OR cloture_by = p_user_id)
              AND created_at >= p_start_time AND created_at < p_end_time
              AND taux_abattement IS NOT NULL
        ), 0),
        'avg_duree', COALESCE((
            SELECT avg(EXTRACT(EPOCH FROM (cloture_at - created_at)) / 60)
            FROM public.reception_tickets
            WHERE (created_by = p_user_id OR cloture_by = p_user_id)
              AND created_at >= p_start_time AND created_at < p_end_time
              AND cloture_at IS NOT NULL
        ), 0)
    ) INTO result;

    RETURN result;
END;
$$;

-- RPC: reception_global_stats (avec Timestamptz)
CREATE OR REPLACE FUNCTION public.reception_global_stats(
    p_start_date timestamp with time zone,
    p_end_date timestamp with time zone
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    result json;
BEGIN
    SELECT json_build_object(
        'total_tickets', (SELECT count(*) FROM public.reception_tickets WHERE created_at >= p_start_date AND created_at < p_end_date),
        'clotures', (SELECT count(*) FROM public.reception_tickets WHERE created_at >= p_start_date AND created_at < p_end_date AND statut = 'cloture'),
        'a_peser', (SELECT count(*) FROM public.reception_tickets WHERE created_at >= p_start_date AND created_at < p_end_date AND etat_pesee = 'a_peser'),
        'poids_total_net', COALESCE((SELECT sum(poids_net_kg) FROM public.v_reception_global WHERE created_at >= p_start_date AND created_at < p_end_date), 0),
        'moy_abattement', COALESCE((SELECT avg(taux_abattement) FROM public.reception_tickets WHERE created_at >= p_start_date AND created_at < p_end_date AND taux_abattement IS NOT NULL), 0),
        'moy_duree', COALESCE((SELECT avg(EXTRACT(EPOCH FROM (cloture_at - created_at)) / 60) FROM public.reception_tickets WHERE created_at >= p_start_date AND created_at < p_end_date AND cloture_at IS NOT NULL), 0)
    ) INTO result;

    RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_reception_user_kpis(uuid, timestamp with time zone, timestamp with time zone) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reception_global_stats(timestamp with time zone, timestamp with time zone) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_reception_user_kpis(uuid, timestamp with time zone, timestamp with time zone) TO service_role;
GRANT EXECUTE ON FUNCTION public.reception_global_stats(timestamp with time zone, timestamp with time zone) TO service_role;
