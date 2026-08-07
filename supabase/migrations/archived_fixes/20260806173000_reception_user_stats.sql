-- Create a function to get KPIs per period for the connected user
CREATE OR REPLACE FUNCTION public.get_reception_user_kpis(
  p_user_id UUID,
  p_start_time TIMESTAMP WITH TIME ZONE,
  p_end_time TIMESTAMP WITH TIME ZONE
)
RETURNS TABLE (
  total_brut NUMERIC,
  total_net NUMERIC,
  total_abattement_kg NUMERIC,
  avg_abattement_pct NUMERIC,
  ticket_count BIGINT
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(SUM(poids_brut_kg), 0)::NUMERIC as total_brut,
    COALESCE(SUM(poids_net_kg), 0)::NUMERIC as total_net,
    COALESCE(SUM(poids_brut_kg - poids_net_kg), 0)::NUMERIC as total_abattement_kg,
    CASE 
      WHEN SUM(poids_brut_kg) > 0 THEN (SUM(poids_brut_kg - poids_net_kg) / SUM(poids_brut_kg)) * 100
      ELSE 0 
    END::NUMERIC as avg_abattement_pct,
    COUNT(*)::BIGINT as ticket_count
  FROM public.v_reception_global
  WHERE (cloture_by = p_user_id::text OR created_by = p_user_id::text) -- v_reception_global has UUID as text
    AND statut = 'cloture'
    AND cloture_at >= p_start_time
    AND cloture_at < p_end_time;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_reception_user_kpis TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_reception_user_kpis TO service_role;
