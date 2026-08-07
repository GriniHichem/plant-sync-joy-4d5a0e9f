CREATE OR REPLACE FUNCTION public.get_reception_user_kpis(
  p_user_id uuid,
  p_start_time timestamp with time zone,
  p_end_time timestamp with time zone
)
RETURNS TABLE(
  total_brut numeric,
  total_net numeric,
  total_abattement_kg numeric,
  avg_abattement_pct numeric,
  ticket_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(SUM(v.poids_brut_kg), 0)::NUMERIC as total_brut,
    COALESCE(SUM(v.poids_net_kg), 0)::NUMERIC as total_net,
    COALESCE(SUM(v.poids_abattement_kg), 0)::NUMERIC as total_abattement_kg,
    CASE
      WHEN SUM(v.poids_brut_kg) > 0 THEN (SUM(v.poids_abattement_kg) / SUM(v.poids_brut_kg)) * 100
      ELSE 0
    END::NUMERIC as avg_abattement_pct,
    COUNT(*)::BIGINT as ticket_count
  FROM v_reception_global v
  WHERE v.statut IN ('cloture', 'pese_importe')
    AND (v.cloture_by = p_user_id OR v.created_by = p_user_id)
    AND (
      (v.cloture_at >= p_start_time AND v.cloture_at < p_end_time)
      OR
      (v.cloture_at IS NULL AND v.created_at >= p_start_time AND v.created_at < p_end_time)
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_reception_user_kpis(uuid, timestamp with time zone, timestamp with time zone) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_reception_user_kpis(uuid, timestamp with time zone, timestamp with time zone) TO service_role;
