-- Drop the existing function to change its return type and structure if needed
DROP FUNCTION IF EXISTS public.reception_global_stats(date, date, uuid, uuid, uuid, text, text, text, timestamp without time zone, timestamp without time zone);

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
    WHERE statut IN ('cloture', 'pese_importe')
  )
  SELECT jsonb_build_object(
    'total', count(*)::integer,
    'brut', COALESCE(sum(poids_brut_kg), 0),
    'net', COALESCE(sum(poids_net_kg), 0),
    'abat', COALESCE(sum(poids_abattement_kg), 0),
    'moy_duree', COALESCE(avg(duree_minutes) FILTER (
      WHERE heure_debut IS NOT NULL AND heure_fin IS NOT NULL AND duree_minutes IS NOT NULL
    ), 0),
    'nb_duree', count(*) FILTER (
      WHERE heure_debut IS NOT NULL AND heure_fin IS NOT NULL AND duree_minutes IS NOT NULL
    )::integer,
    'jours', count(DISTINCT date_ticket)::integer,
    'hd', count(*) FILTER (WHERE duree_minutes > 20)::integer,
    'pese', count(*) FILTER (WHERE etat_pesee = 'pese')::integer,
    'a_peser', count(*) FILTER (WHERE etat_pesee = 'a_peser')::integer,
    -- Additional fields to maintain compatibility with existing frontend expectations
    'tauxAbatMoyen', CASE 
      WHEN (COALESCE(sum(poids_net_kg), 0) + COALESCE(sum(poids_abattement_kg), 0)) > 0 
      THEN (COALESCE(sum(poids_abattement_kg), 0) / (COALESCE(sum(poids_net_kg), 0) + COALESCE(sum(poids_abattement_kg), 0))) * 100
      ELSE 0 
    END,
    'moyNetJour', CASE 
      WHEN count(DISTINCT date_ticket) > 0 
      THEN COALESCE(sum(poids_net_kg), 0) / count(DISTINCT date_ticket) 
      ELSE 0 
    END
  )
  FROM filtered;
$function$;

-- Grant access to the function
GRANT EXECUTE ON FUNCTION public.reception_global_stats(date, date, uuid, uuid, uuid, text, text, text, timestamp, timestamp) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reception_global_stats(date, date, uuid, uuid, uuid, text, text, text, timestamp, timestamp) TO service_role;
