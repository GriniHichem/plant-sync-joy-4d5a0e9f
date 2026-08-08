-- SUJET : Réception F&L – Correction définitive de la durée moyenne dans get_reception_kpis
-- La durée moyenne affichait 0 car le calcul utilisait filter_reception_tickets qui renvoyait déjà duree_minutes (souvent 0 ou incorrect sur les imports).
-- Nous recalculons proprement à partir de heure_debut et heure_fin.

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
  ),
  durations AS (
    SELECT 
      *,
      (
        CASE 
          WHEN heure_fin < heure_debut THEN (heure_fin::time + interval '24 hours') - heure_debut::time
          ELSE heure_fin::time - heure_debut::time
        END
      ) as duration_interval
    FROM filtered
    WHERE heure_debut IS NOT NULL AND heure_fin IS NOT NULL
  )
  SELECT jsonb_build_object(
    'total', (SELECT count(*)::integer FROM filtered),
    'brut', (SELECT COALESCE(sum(poids_brut_kg), 0) FROM filtered),
    'net', (SELECT COALESCE(sum(poids_net_kg), 0) FROM filtered),
    'abat', (SELECT COALESCE(sum(poids_abattement_kg), 0) FROM filtered),
    'moy_duree', (SELECT avg(EXTRACT(EPOCH FROM duration_interval) / 60.0) FROM durations),
    'clotures', (SELECT count(*)::integer FROM durations),
    'hd', (SELECT count(*)::integer FROM filtered WHERE duree_minutes > 20),
    'pese', (SELECT count(*)::integer FROM filtered WHERE etat_pesee = 'pese'),
    'a_peser', (SELECT count(*)::integer FROM filtered WHERE etat_pesee = 'a_peser'),
    'jours', (SELECT count(DISTINCT date_ticket)::integer FROM filtered)
  );
$function$;
