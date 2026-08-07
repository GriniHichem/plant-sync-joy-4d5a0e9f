-- Fix Reception KPIs: Average Duration and "A Peser" (To Weigh) status
-- This migration updates the SQL functions to ensure correct counts and duration calculations.

-- 1. Ensure the function for user-specific KPIs is robust
CREATE OR REPLACE FUNCTION public.get_reception_user_kpis(
    p_user_id uuid,
    p_date_debut timestamp without time zone,
    p_date_fin timestamp without time zone
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    result json;
BEGIN
    SELECT json_build_object(
        'count', COUNT(*),
        'total_poids_net', COALESCE(SUM(poids_net_kg), 0),
        'avg_abattement', COALESCE(AVG(poids_abattement_kg), 0),
        'avg_duree', COALESCE(AVG(EXTRACT(EPOCH FROM (cloture_at - created_at))/60), 0),
        'a_peser_count', COUNT(*) FILTER (WHERE etat_pesee = 'a_peser'),
        'pese_count', COUNT(*) FILTER (WHERE etat_pesee IN ('pese', 'pese_importe'))
    ) INTO result
    FROM v_reception_global
    WHERE (created_by = p_user_id OR cloture_by = p_user_id)
      AND created_at >= p_date_debut
      AND created_at <= p_date_fin;

    RETURN result;
END;
$$;

-- 2. Ensure global stats function includes the requested metrics
CREATE OR REPLACE FUNCTION public.reception_global_stats(
    p_date_debut timestamp without time zone,
    p_date_fin timestamp without time zone,
    p_wilaya text DEFAULT NULL,
    p_region text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    result json;
BEGIN
    SELECT json_build_object(
        'total_tickets', COUNT(*),
        'total_poids_net', COALESCE(SUM(poids_net_kg), 0),
        'moy_abattement', COALESCE(AVG(poids_abattement_kg), 0),
        'moy_duree', COALESCE(AVG(EXTRACT(EPOCH FROM (cloture_at - created_at))/60), 0),
        'a_peser', COUNT(*) FILTER (WHERE etat_pesee = 'a_peser'),
        'clotures', COUNT(*) FILTER (WHERE status = 'cloture'),
        'en_cours', COUNT(*) FILTER (WHERE status = 'ouvert')
    ) INTO result
    FROM v_reception_global
    WHERE created_at >= p_date_debut
      AND created_at <= p_date_fin
      AND (p_wilaya IS NULL OR wilaya = p_wilaya)
      AND (p_region IS NULL OR region = p_region);

    RETURN result;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.get_reception_user_kpis TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reception_global_stats TO authenticated, service_role;

COMMENT ON FUNCTION public.get_reception_user_kpis IS 'Returns user performance indicators including duration and weighing status.';
COMMENT ON FUNCTION public.reception_global_stats IS 'Returns global reception statistics including average duration and pending weighings.';
