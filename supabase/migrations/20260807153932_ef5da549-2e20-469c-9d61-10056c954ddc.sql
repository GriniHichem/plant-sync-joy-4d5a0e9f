-- Update get_reception_user_kpis to be robust against data types and field names
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
    COALESCE(SUM(v.poids_brut_kg), 0)::NUMERIC as total_brut,
    COALESCE(SUM(v.poids_net_kg), 0)::NUMERIC as total_net,
    COALESCE(SUM(v.poids_abattement_kg), 0)::NUMERIC as total_abattement_kg,
    CASE 
      WHEN SUM(v.poids_brut_kg) > 0 THEN (SUM(v.poids_abattement_kg) / SUM(v.poids_brut_kg)) * 100
      ELSE 0 
    END::NUMERIC as avg_abattement_pct,
    COUNT(*)::BIGINT as ticket_count
  FROM v_reception_global v
  WHERE v.statut = 'cloture'
    AND (v.cloture_by::text = p_user_id::text OR v.created_by::text = p_user_id::text)
    AND (
      (v.cloture_at >= p_start_time AND v.cloture_at < p_end_time)
      OR 
      (v.cloture_at IS NULL AND v.created_at >= p_start_time AND v.created_at < p_end_time)
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_reception_user_kpis TO authenticated, service_role;

-- Ensure reception_global_stats handles timestamp ranges and filters correctly
CREATE OR REPLACE FUNCTION public.reception_global_stats(
  p_from date DEFAULT NULL, p_to date DEFAULT NULL,
  p_campaign uuid DEFAULT NULL, p_supplier uuid DEFAULT NULL, p_product uuid DEFAULT NULL,
  p_etat text DEFAULT NULL, p_conformite text DEFAULT NULL, p_q text DEFAULT NULL,
  p_from_ts timestamp without time zone DEFAULT NULL, p_to_ts timestamp without time zone DEFAULT NULL
)
RETURNS json
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  WITH s AS (
    SELECT v.*
    FROM public.v_reception_global v
    WHERE (p_from IS NULL OR v.date_ticket >= p_from)
      AND (p_to IS NULL OR v.date_ticket <= p_to)
      -- Handle timestamp filters by combining date and time if necessary, but v_reception_global has timestamps
      AND (p_from_ts IS NULL OR COALESCE(v.cloture_at::timestamp, (v.date_ticket + COALESCE(v.heure_debut, '00:00'::time))::timestamp) >= p_from_ts)
      AND (p_to_ts IS NULL OR COALESCE(v.cloture_at::timestamp, (v.date_ticket + COALESCE(v.heure_debut, '00:00'::time))::timestamp) <= p_to_ts)
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
      )
  )
  SELECT json_build_object(
    'total', COUNT(*),
    'pese', COUNT(*) FILTER (WHERE s.etat_pesee = 'pese'),
    'aPeser', COUNT(*) FILTER (WHERE s.etat_pesee <> 'pese'),
    'hd', COUNT(*) FILTER (WHERE s.duree_minutes > 20),
    'brut', COALESCE(SUM(s.poids_brut_kg), 0),
    'abat', COALESCE(SUM(s.poids_abattement_kg), 0),
    'net', COALESCE(SUM(s.poids_net_kg), 0),
    'moyDuree', AVG(s.duree_minutes) FILTER (
        WHERE s.heure_debut IS NOT NULL AND s.heure_fin IS NOT NULL AND s.duree_minutes IS NOT NULL),
    'nbDuree', COUNT(*) FILTER (
        WHERE s.heure_debut IS NOT NULL AND s.heure_fin IS NOT NULL AND s.duree_minutes IS NOT NULL),
    'tauxAbatMoyen', CASE WHEN COALESCE(SUM(s.poids_brut_kg),0) > 0
        THEN SUM(s.poids_abattement_kg) / SUM(s.poids_brut_kg) * 100 END,
    'jours', COUNT(DISTINCT s.date_ticket),
    'moyNetJour', CASE WHEN COUNT(DISTINCT s.date_ticket) > 0
        THEN COALESCE(SUM(s.poids_net_kg),0) / COUNT(DISTINCT s.date_ticket) END
  )
  FROM s;
$function$;

GRANT EXECUTE ON FUNCTION public.reception_global_stats(date,date,uuid,uuid,uuid,text,text,text,timestamp,timestamp) TO authenticated, anon, service_role;
