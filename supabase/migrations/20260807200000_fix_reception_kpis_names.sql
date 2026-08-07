-- Correction des noms de champs dans la RPC get_reception_kpis pour correspondre au frontend
CREATE OR REPLACE FUNCTION public.get_reception_kpis(
  p_date_from date DEFAULT NULL::date, 
  p_date_to date DEFAULT NULL::date, 
  p_campaign_id uuid DEFAULT NULL::uuid, 
  p_supplier_id uuid DEFAULT NULL::uuid, 
  p_product_id uuid DEFAULT NULL::uuid, 
  p_etat text DEFAULT NULL::text, 
  p_conformite text DEFAULT NULL::text, 
  p_search text DEFAULT NULL::text, 
  p_dt_from timestamp without time zone DEFAULT NULL::timestamp without time zone, 
  p_dt_to timestamp without time zone DEFAULT NULL::timestamp without time zone
)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  WITH filtered AS (
    SELECT *
    FROM public.filter_reception_tickets(
      p_date_from, p_date_to, p_campaign_id, p_supplier_id, p_product_id,
      p_etat, p_conformite, p_search, p_dt_from, p_dt_to
    )
  )
  SELECT jsonb_build_object(
    'total', count(*)::integer,
    'brut', COALESCE(sum(poids_brut_kg), 0),
    'net', COALESCE(sum(poids_net_kg), 0),
    'abat', COALESCE(sum(poids_abattement_kg), 0),
    'tauxAbatMoyen', COALESCE(AVG(taux_abattement), 0),
    'moyDuree', avg(duree_minutes) FILTER (
      WHERE duree_minutes IS NOT NULL
    ),
    'nb_duree', count(*) FILTER (
      WHERE duree_minutes IS NOT NULL
    )::integer,
    'jours', count(DISTINCT date_ticket)::integer,
    'hd', count(*) FILTER (WHERE duree_minutes > 20)::integer,
    'pese', count(*) FILTER (WHERE etat_pesee = 'pese')::integer,
    'aPeser', count(*) FILTER (WHERE etat_pesee = 'a_peser')::integer,
    'moyNetJour', CASE WHEN count(DISTINCT date_ticket) > 0 THEN COALESCE(sum(poids_net_kg), 0) / count(DISTINCT date_ticket) ELSE 0 END
  )
  FROM filtered;
$$;

GRANT EXECUTE ON FUNCTION public.get_reception_kpis(date, date, uuid, uuid, uuid, text, text, text, timestamp without time zone, timestamp without time zone) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_reception_kpis(date, date, uuid, uuid, uuid, text, text, text, timestamp without time zone, timestamp without time zone) TO service_role;
