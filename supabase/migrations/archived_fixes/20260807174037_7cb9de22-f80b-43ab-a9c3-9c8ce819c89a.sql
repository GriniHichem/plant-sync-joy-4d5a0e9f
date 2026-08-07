-- Nettoyage agressif des signatures existantes
DROP FUNCTION IF EXISTS public.get_reception_user_kpis(uuid, timestamp with time zone, timestamp with time zone) CASCADE;
DROP FUNCTION IF EXISTS public.get_reception_user_kpis(uuid, timestamp without time zone, timestamp without time zone) CASCADE;
DROP FUNCTION IF EXISTS public.get_reception_kpis(date, date, uuid, uuid, uuid, text, text, text, timestamp without time zone, timestamp without time zone) CASCADE;
DROP FUNCTION IF EXISTS public.filter_reception_tickets(date, date, uuid, uuid, uuid, text, text, text, timestamp without time zone, timestamp without time zone) CASCADE;
DROP FUNCTION IF EXISTS public.reception_global_stats(date, date, uuid, uuid, uuid, text, text, text, timestamp without time zone, timestamp without time zone) CASCADE;

-- 1. filter_reception_tickets
CREATE OR REPLACE FUNCTION public.filter_reception_tickets(
  p_date_from date DEFAULT NULL,
  p_date_to date DEFAULT NULL,
  p_campaign_id uuid DEFAULT NULL,
  p_supplier_id uuid DEFAULT NULL,
  p_product_id uuid DEFAULT NULL,
  p_etat text DEFAULT NULL,
  p_conformite text DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_dt_from timestamp without time zone DEFAULT NULL,
  p_dt_to timestamp without time zone DEFAULT NULL
)
RETURNS SETOF public.v_reception_global
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT v.*
  FROM public.v_reception_global AS v
  WHERE (p_date_from IS NULL OR v.date_ticket >= p_date_from)
    AND (p_date_to IS NULL OR v.date_ticket <= p_date_to)
    AND (p_campaign_id IS NULL OR v.campaign_id = p_campaign_id)
    AND (p_supplier_id IS NULL OR v.supplier_id = p_supplier_id)
    AND (p_product_id IS NULL OR v.product_id = p_product_id)
    AND (
      p_etat IS NULL OR p_etat = '__all__'
      OR (p_etat = 'a_peser' AND v.etat_pesee = 'a_peser')
      OR (p_etat = 'pese' AND v.etat_pesee = 'pese')
    )
    AND (
      p_conformite IS NULL OR p_conformite = '__all__'
      OR (p_conformite = 'conforme' AND (v.duree_minutes IS NULL OR v.duree_minutes <= 20))
      OR (p_conformite = 'hors_delai' AND v.duree_minutes > 20)
    )
    AND (
      p_dt_from IS NULL 
      OR v.created_at >= p_dt_from
    )
    AND (
      p_dt_to IS NULL 
      OR v.created_at <= p_dt_to
    )
    AND (
      NULLIF(btrim(p_search), '') IS NULL
      OR lower(v.numero) LIKE '%' || lower(btrim(p_search)) || '%'
      OR lower(v.fournisseur) LIKE '%' || lower(btrim(p_search)) || '%'
      OR lower(v.produit) LIKE '%' || lower(btrim(p_search)) || '%'
      OR lower(v.wilaya) LIKE '%' || lower(btrim(p_search)) || '%'
      OR lower(v.region) LIKE '%' || lower(btrim(p_search)) || '%'
    )
    AND v.statut IN ('cloture', 'pese_importe');
$$;

-- 2. get_reception_kpis
CREATE OR REPLACE FUNCTION public.get_reception_kpis(
  p_date_from date DEFAULT NULL,
  p_date_to date DEFAULT NULL,
  p_campaign_id uuid DEFAULT NULL,
  p_supplier_id uuid DEFAULT NULL,
  p_product_id uuid DEFAULT NULL,
  p_etat text DEFAULT NULL,
  p_conformite text DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_dt_from timestamp without time zone DEFAULT NULL,
  p_dt_to timestamp without time zone DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
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
    'moy_duree', avg(duree_minutes) FILTER (
      WHERE duree_minutes IS NOT NULL
    ),
    'nb_duree', count(*) FILTER (
      WHERE duree_minutes IS NOT NULL
    )::integer,
    'jours', count(DISTINCT date_ticket)::integer,
    'hd', count(*) FILTER (WHERE duree_minutes > 20)::integer,
    'pese', count(*) FILTER (WHERE etat_pesee = 'pese')::integer,
    'a_peser', count(*) FILTER (WHERE etat_pesee = 'a_peser')::integer,
    'moyNetJour', CASE WHEN count(DISTINCT date_ticket) > 0 THEN COALESCE(sum(poids_net_kg), 0) / count(DISTINCT date_ticket) ELSE 0 END
  )
  FROM filtered;
$$;

-- 3. get_reception_user_kpis
CREATE OR REPLACE FUNCTION public.get_reception_user_kpis(
  p_user_id uuid,
  p_start_time timestamp without time zone,
  p_end_time timestamp without time zone
)
RETURNS TABLE(
  total_brut numeric,
  total_net numeric,
  total_abattement_kg numeric,
  avg_abattement_pct numeric,
  ticket_count bigint
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    COALESCE(SUM(poids_brut_kg), 0)::numeric,
    COALESCE(SUM(poids_net_kg), 0)::numeric,
    COALESCE(SUM(poids_abattement_kg), 0)::numeric,
    COALESCE(AVG(taux_abattement), 0)::numeric,
    COUNT(*)::bigint
  FROM public.v_reception_global
  WHERE (cloture_by = p_user_id OR created_by = p_user_id)
    AND created_at >= p_start_time
    AND created_at < p_end_time
    AND statut IN ('cloture', 'pese_importe');
$$;

-- 4. reception_global_stats (alias json)
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
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.get_reception_kpis(
    p_from, p_to, p_campaign, p_supplier, p_product,
    p_etat, p_conformite, p_q, p_from_ts, p_to_ts
  )::json;
$$;

GRANT EXECUTE ON FUNCTION public.filter_reception_tickets TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_reception_kpis TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_reception_user_kpis TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reception_global_stats TO authenticated, service_role;
