-- CONSOLIDATED ROBUST RECEPTION KPI FIX (v3)
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

CREATE OR REPLACE FUNCTION public.reception_global_stats(
  p_from date DEFAULT NULL,
  p_to date DEFAULT NULL,
  p_campaign uuid DEFAULT NULL,
  p_supplier uuid DEFAULT NULL,
  p_product uuid DEFAULT NULL,
  p_etat text DEFAULT NULL,
  p_conformite text DEFAULT NULL,
  p_q text DEFAULT NULL,
  p_from_ts timestamp without time zone DEFAULT NULL,
  p_to_ts timestamp without time zone DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result json;
BEGIN
  WITH filtered_data AS (
    SELECT *
    FROM v_reception_global
    WHERE 
      (p_from IS NULL OR date_ticket >= p_from)
      AND (p_to IS NULL OR date_ticket <= p_to)
      AND (p_campaign IS NULL OR campaign_id = p_campaign)
      AND (p_supplier IS NULL OR supplier_id = p_supplier)
      AND (p_product IS NULL OR product_id = p_product)
      AND (p_etat IS NULL OR etat_pesee = p_etat)
      AND (p_from_ts IS NULL OR created_at >= p_from_ts)
      AND (p_to_ts IS NULL OR created_at < p_to_ts)
      AND (p_q IS NULL OR (
        numero ILIKE '%' || p_q || '%'
        OR fournisseur ILIKE '%' || p_q || '%'
        OR produit ILIKE '%' || p_q || '%'
        OR wilaya ILIKE '%' || p_q || '%'
        OR region ILIKE '%' || p_q || '%'
      ))
      AND (p_conformite IS NULL OR (
        (p_conformite = 'conforme' AND (duree_minutes IS NULL OR duree_minutes <= 20))
        OR (p_conformite = 'hors_delai' AND duree_minutes > 20)
      ))
  )
  SELECT json_build_object(
    'total', COUNT(*),
    'pese', COUNT(*) FILTER (WHERE etat_pesee = 'pese'),
    'aPeser', COUNT(*) FILTER (WHERE etat_pesee = 'a_peser'),
    'hd', COUNT(*) FILTER (WHERE duree_minutes > 20),
    'brut', COALESCE(SUM(poids_brut_kg), 0),
    'net', COALESCE(SUM(poids_net_kg), 0),
    'abat', COALESCE(SUM(poids_abattement_kg), 0),
    'tauxAbatMoyen', COALESCE(AVG(taux_abattement), 0),
    'moyDuree', COALESCE(AVG(duree_minutes) FILTER (WHERE duree_minutes IS NOT NULL), 0),
    'nbDuree', COUNT(*) FILTER (WHERE duree_minutes IS NOT NULL),
    'jours', COUNT(DISTINCT date_ticket),
    'moyNetJour', CASE WHEN COUNT(DISTINCT date_ticket) > 0 THEN COALESCE(SUM(poids_net_kg), 0) / COUNT(DISTINCT date_ticket) ELSE 0 END
  ) INTO v_result
  FROM filtered_data;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_reception_user_kpis(uuid, timestamp with time zone, timestamp with time zone) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_reception_user_kpis(uuid, timestamp with time zone, timestamp with time zone) TO service_role;
GRANT EXECUTE ON FUNCTION public.reception_global_stats(date, date, uuid, uuid, uuid, text, text, text, timestamp, timestamp) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reception_global_stats(date, date, uuid, uuid, uuid, text, text, text, timestamp, timestamp) TO service_role;

-- Correction des droits sur les préférences
GRANT ALL ON public.user_dashboard_preferences TO authenticated;
GRANT ALL ON public.user_dashboard_preferences TO service_role;
