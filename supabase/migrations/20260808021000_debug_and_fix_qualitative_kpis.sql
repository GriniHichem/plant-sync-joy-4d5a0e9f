-- SUJET : Réception F&L – Fix robuste des KPIs Qualitatifs (Abattement kg)
-- Le problème est souvent lié au fait que w.poids_brut peut être NULL ou 0 sur des tickets non pesés.
-- On s'assure de prendre en compte tous les tickets clôturés et d'agréger correctement.

CREATE OR REPLACE FUNCTION public.get_reception_qualitative_kpis(p_target_date date)
RETURNS TABLE(
  period_name text,
  avg_abattement_pct numeric,
  total_net_kg numeric,
  total_abat_kg numeric,
  ticket_count integer
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  WITH periods AS (
    -- Définition des Shifts (6h -> 14h, 14h -> 22h, 22h -> 6h J+1)
    SELECT 'Matin (6h-14h)' as p_name, (p_target_date + interval '6 hours') as start_ts, (p_target_date + interval '14 hours') as end_ts, 1 as sort_order
    UNION ALL
    SELECT 'Après-midi (14h-22h)', (p_target_date + interval '14 hours'), (p_target_date + interval '22 hours'), 2
    UNION ALL
    SELECT 'Nuit (22h-6h)', (p_target_date + interval '22 hours'), (p_target_date + interval '30 hours'), 3
  ),
  tickets_in_periods AS (
    SELECT 
      p.p_name,
      t.taux_abattement,
      -- Utilisation directe de la table pesée pour éviter les jointures complexes ou vues obsolètes
      COALESCE(w.poids_brut, 0) as brut,
      t.id
    FROM periods p
    LEFT JOIN public.reception_tickets t ON 
      t.cloture_at >= p.start_ts AND t.cloture_at < p.end_ts
      AND t.statut IN ('cloture', 'pese_importe')
    LEFT JOIN public.reception_weighings w ON t.id = w.ticket_id
  )
  SELECT 
    p.p_name,
    COALESCE(AVG(tip.taux_abattement), 0)::numeric(10,2) as avg_abattement_pct,
    COALESCE(SUM(tip.brut * (1 - tip.taux_abattement / 100.0)), 0)::numeric(12,2) as total_net_kg,
    COALESCE(SUM(tip.brut * (tip.taux_abattement / 100.0)), 0)::numeric(12,2) as total_abat_kg,
    COUNT(tip.id)::integer as ticket_count
  FROM periods p
  LEFT JOIN tickets_in_periods tip ON tip.p_name = p.p_name
  GROUP BY p.p_name, p.sort_order
  ORDER BY p.sort_order;
END;
$function$;

-- Mise à jour de la vue v_reception_global pour être cohérent avec le calcul direct
CREATE OR REPLACE VIEW public.v_reception_global AS
SELECT 
    t.id,
    t.numero,
    t.code_saisi,
    t.date_ticket,
    t.heure_debut,
    t.heure_fin,
    t.taux_abattement,
    t.commentaire,
    t.statut,
    t.created_at,
    t.cloture_at,
    t.created_by,
    t.cloture_by,
    t.campaign_id,
    c.libelle as campagne,
    t.supplier_id,
    s.nom as fournisseur,
    s.code as code_fournisseur,
    t.product_id,
    p.designation as produit,
    COALESCE(w.poids_brut, 0) as poids_brut_kg,
    COALESCE(w.poids_brut * (t.taux_abattement / 100.0), 0) as poids_abattement_kg,
    COALESCE(w.poids_brut * (1 - t.taux_abattement / 100.0), 0) as poids_net_kg,
    (SELECT count(*) FROM public.reception_ticket_photos WHERE ticket_id = t.id) as nb_photos,
    CASE WHEN w.poids_brut IS NOT NULL THEN 'pese' ELSE 'a_peser' END as etat_pesee,
    EXTRACT(EPOCH FROM (CASE WHEN t.heure_fin < t.heure_debut THEN (t.heure_fin::time + interval '24 hours') - t.heure_debut::time ELSE t.heure_fin::time - t.heure_debut::time END)) / 60.0 as duree_minutes
FROM public.reception_tickets t
LEFT JOIN public.reception_campaigns c ON t.campaign_id = c.id
LEFT JOIN public.reception_suppliers s ON t.supplier_id = s.id
LEFT JOIN public.reception_products p ON t.product_id = p.id
LEFT JOIN public.reception_weighings w ON t.id = w.ticket_id;

GRANT SELECT ON public.v_reception_global TO authenticated;
