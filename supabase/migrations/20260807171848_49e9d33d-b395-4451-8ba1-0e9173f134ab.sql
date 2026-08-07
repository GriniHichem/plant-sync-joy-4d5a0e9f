-- Consolidated Migration: Harmonize Reception KPI functions with exact user logic
-- Replaces previous versions of these functions to ensure stability and accuracy

-- 1. DROP old versions with EXACT signatures found in DB
DROP FUNCTION IF EXISTS public.get_reception_user_kpis(uuid, timestamp with time zone, timestamp with time zone);
DROP FUNCTION IF EXISTS public.get_reception_user_kpis(uuid, timestamp without time zone, timestamp without time zone);
DROP FUNCTION IF EXISTS public.get_reception_kpis(date, date, uuid, uuid, uuid, text, text, text, timestamp without time zone, timestamp without time zone);
DROP FUNCTION IF EXISTS public.reception_global_stats(date, date, uuid, uuid, uuid, text, text, text, timestamp without time zone, timestamp without time zone);
DROP FUNCTION IF EXISTS public.get_reception_kpis(date, date, uuid, uuid, uuid, text, text, text);

-- 2. CREATE robust filter function
CREATE OR REPLACE FUNCTION public.filter_reception_tickets(
  p_date_from date DEFAULT NULL,
  p_date_to date DEFAULT NULL,
  p_campaign_id uuid DEFAULT NULL,
  p_supplier_id uuid DEFAULT NULL,
  p_product_id uuid DEFAULT NULL,
  p_etat text DEFAULT NULL,
  p_conformite text DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_dt_from timestamp DEFAULT NULL,
  p_dt_to timestamp DEFAULT NULL
)
RETURNS SETOF public.v_reception_global
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
      OR (v.date_ticket || ' ' || COALESCE(v.heure_debut, '00:00:00'))::timestamp >= p_dt_from
    )
    AND (
      p_dt_to IS NULL 
      OR (v.date_ticket || ' ' || COALESCE(v.heure_debut, '00:00:00'))::timestamp <= p_dt_to
    )
    AND (
      NULLIF(btrim(p_search), '') IS NULL
      OR lower(v.numero) LIKE '%' || lower(btrim(p_search)) || '%'
      OR lower(v.fournisseur) LIKE '%' || lower(btrim(p_search)) || '%'
      OR lower(v.produit) LIKE '%' || lower(btrim(p_search)) || '%'
      OR lower(v.wilaya) LIKE '%' || lower(btrim(p_search)) || '%'
      OR lower(v.region) LIKE '%' || lower(btrim(p_search)) || '%'
    );
$function$;

-- 3. CREATE global stats function using user's SQL logic
CREATE OR REPLACE FUNCTION public.get_reception_kpis(
  p_date_from date DEFAULT NULL,
  p_date_to date DEFAULT NULL,
  p_campaign_id uuid DEFAULT NULL,
  p_supplier_id uuid DEFAULT NULL,
  p_product_id uuid DEFAULT NULL,
  p_etat text DEFAULT NULL,
  p_conformite text DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_dt_from timestamp DEFAULT NULL,
  p_dt_to timestamp DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH filtered AS (
    SELECT *
    FROM public.filter_reception_tickets(
      p_date_from, p_date_to, p_campaign_id, p_supplier_id, p_product_id,
      p_etat, p_conformite, p_search, p_dt_from, p_dt_to
    )
    WHERE statut IN ('cloture', 'pese_importe')
  )
  SELECT jsonb_build_object(
    'total', count(*)::integer,
    'brut', COALESCE(sum(poids_brut_kg), 0),
    'net', COALESCE(sum(poids_net_kg), 0),
    'abat', COALESCE(sum(poids_abattement_kg), 0),
    'moy_duree', avg(duree_minutes) FILTER (
      WHERE heure_debut IS NOT NULL AND heure_fin IS NOT NULL AND duree_minutes IS NOT NULL
    ),
    'nb_duree', count(*) FILTER (
      WHERE heure_debut IS NOT NULL AND heure_fin IS NOT NULL AND duree_minutes IS NOT NULL
    )::integer,
    'jours', count(DISTINCT date_ticket)::integer,
    'hd', count(*) FILTER (WHERE duree_minutes > 20)::integer,
    'pese', count(*) FILTER (WHERE etat_pesee = 'pese')::integer,
    'a_peser', count(*) FILTER (WHERE etat_pesee = 'a_peser')::integer
  )
  FROM filtered;
$function$;

-- 4. CREATE user specific KPIs function using user's SQL logic
CREATE OR REPLACE FUNCTION public.get_reception_user_kpis(
  p_user_id uuid,
  p_start_time timestamp,
  p_end_time timestamp
)
RETURNS TABLE (
  total_brut numeric,
  total_net numeric,
  total_abattement_kg numeric,
  avg_abattement_pct numeric,
  ticket_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT 
    COALESCE(SUM(poids_brut_kg), 0)::numeric,
    COALESCE(SUM(poids_net_kg), 0)::numeric,
    COALESCE(SUM(poids_abattement_kg), 0)::numeric,
    COALESCE(AVG(taux_abattement), 0)::numeric,
    COUNT(*)::bigint
  FROM public.v_reception_global
  WHERE (cloture_by = p_user_id OR created_by = p_user_id)
    AND (
      (statut = 'cloture' AND cloture_at >= p_start_time AND cloture_at < p_end_time)
      OR 
      (statut = 'pese_importe' AND created_at >= p_start_time AND created_at < p_end_time)
    )
    AND statut IN ('cloture', 'pese_importe');
$function$;

-- 5. GRANTS
GRANT EXECUTE ON FUNCTION public.filter_reception_tickets TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_reception_kpis TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_reception_user_kpis TO authenticated;

-- Alias for legacy
CREATE OR REPLACE FUNCTION public.reception_global_stats(
  p_date_from date DEFAULT NULL,
  p_date_to date DEFAULT NULL,
  p_campaign_id uuid DEFAULT NULL,
  p_supplier_id uuid DEFAULT NULL,
  p_product_id uuid DEFAULT NULL,
  p_etat text DEFAULT NULL,
  p_conformite text DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_dt_from timestamp DEFAULT NULL,
  p_dt_to timestamp DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT public.get_reception_kpis(
    p_date_from, p_date_to, p_campaign_id, p_supplier_id, p_product_id,
    p_etat, p_conformite, p_search, p_dt_from, p_dt_to
  );
$function$;

GRANT EXECUTE ON FUNCTION public.reception_global_stats TO authenticated;
