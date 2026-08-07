DROP FUNCTION IF EXISTS public.get_reception_user_kpis(uuid, timestamp without time zone, timestamp without time zone);

CREATE OR REPLACE FUNCTION public.get_reception_user_kpis(p_user_id uuid, p_start_time timestamp without time zone, p_end_time timestamp without time zone)
 RETURNS TABLE(total_brut numeric, total_net numeric, total_abattement_kg numeric, avg_abattement_pct numeric, ticket_count bigint, avg_duree numeric, a_peser_count bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT 
    COALESCE(SUM(poids_brut_kg), 0)::numeric,
    COALESCE(SUM(poids_net_kg), 0)::numeric,
    COALESCE(SUM(poids_abattement_kg), 0)::numeric,
    COALESCE(AVG(taux_abattement), 0)::numeric,
    COUNT(*)::bigint,
    COALESCE(AVG(duree_minutes), 0)::numeric,
    COUNT(*) FILTER (WHERE etat_pesee = 'a_peser')::bigint
  FROM public.v_reception_global
  WHERE (cloture_by = p_user_id OR created_by = p_user_id)
    AND created_at >= p_start_time
    AND created_at < p_end_time
    AND statut IN ('cloture', 'pese_importe');
$function$;