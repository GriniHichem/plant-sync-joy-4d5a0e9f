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
    WHERE statut IN ('cloture', 'pese_importe')
      AND (p_from IS NULL OR date_ticket >= p_from)
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
