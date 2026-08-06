CREATE OR REPLACE FUNCTION public.reception_global_stats(
  p_from date DEFAULT NULL,
  p_to date DEFAULT NULL,
  p_campaign uuid DEFAULT NULL,
  p_supplier uuid DEFAULT NULL,
  p_product uuid DEFAULT NULL,
  p_etat text DEFAULT NULL,
  p_conformite text DEFAULT NULL,
  p_q text DEFAULT NULL,
  p_from_ts timestamp DEFAULT NULL,
  p_to_ts timestamp DEFAULT NULL
)
RETURNS json
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT json_build_object(
    'total', COUNT(*),
    'pese', COUNT(*) FILTER (WHERE v.etat_pesee = 'pese'),
    'aPeser', COUNT(*) FILTER (WHERE v.etat_pesee <> 'pese'),
    'hd', COUNT(*) FILTER (WHERE v.duree_minutes > 20),
    'brut', COALESCE(SUM(v.poids_brut_kg), 0),
    'abat', COALESCE(SUM(v.poids_abattement_kg), 0),
    'net', COALESCE(SUM(v.poids_net_kg), 0),
    'moyDuree', AVG(v.duree_minutes)
  )
  FROM public.v_reception_global v
  WHERE (p_from IS NULL OR v.date_ticket >= p_from)
    AND (p_to IS NULL OR v.date_ticket <= p_to)
    AND (p_from_ts IS NULL OR (v.date_ticket + COALESCE(v.heure_debut, '00:00'::time)) >= p_from_ts)
    AND (p_to_ts IS NULL OR (v.date_ticket + COALESCE(v.heure_debut, '00:00'::time)) <= p_to_ts)
    AND (p_campaign IS NULL OR v.campaign_id = p_campaign)
    AND (p_supplier IS NULL OR v.supplier_id = p_supplier)
    AND (p_product IS NULL OR v.product_id = p_product)
    AND (p_etat IS NULL OR v.etat_pesee = p_etat)
    AND (
      p_conformite IS NULL
      OR (p_conformite = 'conforme' AND COALESCE(v.duree_minutes, 0) <= 20)
      OR (p_conformite = 'hors_delai' AND v.duree_minutes > 20)
    )
    AND (
      p_q IS NULL OR p_q = ''
      OR v.numero ILIKE '%' || p_q || '%'
      OR COALESCE(v.fournisseur, '') ILIKE '%' || p_q || '%'
      OR COALESCE(v.produit, '') ILIKE '%' || p_q || '%'
      OR COALESCE(v.wilaya, '') ILIKE '%' || p_q || '%'
      OR COALESCE(v.region, '') ILIKE '%' || p_q || '%'
    );
$$;

GRANT EXECUTE ON FUNCTION public.reception_global_stats(date, date, uuid, uuid, uuid, text, text, text, timestamp, timestamp) TO authenticated;