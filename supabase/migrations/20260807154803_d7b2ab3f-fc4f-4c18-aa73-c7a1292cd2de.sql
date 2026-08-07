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
      AND (p_etat IS NULL OR statut = p_etat)
      AND (p_from_ts IS NULL OR created_at >= p_from_ts)
      AND (p_to_ts IS NULL OR created_at < p_to_ts)
      AND (p_q IS NULL OR (
        numero ILIKE '%' || p_q || '%'
        OR fournisseur ILIKE '%' || p_q || '%'
        OR produit ILIKE '%' || p_q || '%'
      ))
  )
  SELECT json_build_object(
    'total_tickets', COUNT(*),
    'total_brut', COALESCE(SUM(poids_brut_kg), 0),
    'total_net', COALESCE(SUM(poids_net_kg), 0),
    'avg_abattement', COALESCE(AVG(taux_abattement), 0),
    'poids_abattement_kg', COALESCE(SUM(poids_abattement_kg), 0),
    'avg_duree', COALESCE(AVG(duree_minutes) FILTER (WHERE duree_minutes IS NOT NULL), 0)
  ) INTO v_result
  FROM filtered_data;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reception_global_stats(date, date, uuid, uuid, uuid, text, text, text, timestamp, timestamp) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reception_global_stats(date, date, uuid, uuid, uuid, text, text, text, timestamp, timestamp) TO service_role;
