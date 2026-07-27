DROP FUNCTION IF EXISTS public.get_reception_kpis(date, date, uuid, uuid, uuid, text, text, text);
DROP FUNCTION IF EXISTS public.filter_reception_tickets(date, date, uuid, uuid, uuid, text, text, text);

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
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
  SELECT v.*
  FROM public.v_reception_global AS v
  WHERE (p_date_from IS NULL OR v.date_ticket >= p_date_from)
    AND (p_date_to IS NULL OR v.date_ticket <= p_date_to)
    AND (
      p_dt_from IS NULL
      OR (v.date_ticket + COALESCE(v.heure_debut, TIME '00:00')) >= p_dt_from
    )
    AND (
      p_dt_to IS NULL
      OR (v.date_ticket + COALESCE(v.heure_debut, TIME '00:00')) <= p_dt_to
    )
    AND (p_campaign_id IS NULL OR v.campaign_id = p_campaign_id)
    AND (p_supplier_id IS NULL OR v.supplier_id = p_supplier_id)
    AND (p_product_id IS NULL OR v.product_id = p_product_id)
    AND (
      p_etat IS NULL
      OR (p_etat = 'sans_brut' AND v.poids_brut_kg IS NULL)
      OR (p_etat = 'a_peser' AND v.etat_pesee = 'a_peser')
      OR (p_etat = 'pese' AND v.etat_pesee = 'pese')
    )
    AND (
      p_conformite IS NULL
      OR (
        p_conformite = 'conforme'
        AND (v.duree_minutes IS NULL OR v.duree_minutes <= 20)
      )
      OR (
        p_conformite = 'hors_delai'
        AND v.duree_minutes > 20
      )
    )
    AND (
      NULLIF(btrim(p_search), '') IS NULL
      OR lower(COALESCE(v.numero, '')) LIKE '%' || lower(btrim(p_search)) || '%'
      OR lower(COALESCE(v.fournisseur, '')) LIKE '%' || lower(btrim(p_search)) || '%'
      OR lower(COALESCE(v.produit, '')) LIKE '%' || lower(btrim(p_search)) || '%'
      OR lower(COALESCE(v.wilaya, '')) LIKE '%' || lower(btrim(p_search)) || '%'
      OR lower(COALESCE(v.region, '')) LIKE '%' || lower(btrim(p_search)) || '%'
    );
$function$;

REVOKE ALL ON FUNCTION public.filter_reception_tickets(
  date, date, uuid, uuid, uuid, text, text, text, timestamp, timestamp
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.filter_reception_tickets(
  date, date, uuid, uuid, uuid, text, text, text, timestamp, timestamp
) TO authenticated;

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
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
  WITH filtered AS (
    SELECT *
    FROM public.filter_reception_tickets(
      p_date_from,
      p_date_to,
      p_campaign_id,
      p_supplier_id,
      p_product_id,
      p_etat,
      p_conformite,
      p_search,
      p_dt_from,
      p_dt_to
    )
  )
  SELECT jsonb_build_object(
    'total', count(*)::integer,
    'brut', COALESCE(sum(poids_brut_kg), 0),
    'net', COALESCE(sum(poids_net_kg), 0),
    'abat', COALESCE(sum(poids_abattement_kg), 0),
    'moy_duree', avg(duree_minutes),
    'hd', count(*) FILTER (WHERE duree_minutes > 20)::integer,
    'pese', count(*) FILTER (WHERE etat_pesee = 'pese')::integer,
    'a_peser', count(*) FILTER (WHERE etat_pesee = 'a_peser')::integer
  )
  FROM filtered;
$function$;

REVOKE ALL ON FUNCTION public.get_reception_kpis(
  date, date, uuid, uuid, uuid, text, text, text, timestamp, timestamp
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_reception_kpis(
  date, date, uuid, uuid, uuid, text, text, text, timestamp, timestamp
) TO authenticated;