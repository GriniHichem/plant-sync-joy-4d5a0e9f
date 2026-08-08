-- SUJET : Réception F&L – Correction des alias dans v_reception_global pour les KPIs
-- La vue v_reception_global doit exposer les colonnes attendues par get_reception_qualitative_kpis.

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
    -- Poids et calculs
    w.poids_brut as poids_brut_kg,
    COALESCE(w.poids_brut * (t.taux_abattement / 100.0), 0) as poids_abattement_kg,
    COALESCE(w.poids_brut * (1 - t.taux_abattement / 100.0), 0) as poids_net_kg,
    -- Métadonnées
    (SELECT count(*) FROM public.reception_ticket_photos WHERE ticket_id = t.id) as nb_photos,
    CASE 
      WHEN w.poids_brut IS NOT NULL THEN 'pese'
      ELSE 'a_peser'
    END as etat_pesee,
    -- Durée
    EXTRACT(EPOCH FROM (
      CASE 
        WHEN t.heure_fin < t.heure_debut THEN (t.heure_fin::time + interval '24 hours') - t.heure_debut::time
        ELSE t.heure_fin::time - t.heure_debut::time
      END
    )) / 60.0 as duree_minutes
FROM public.reception_tickets t
LEFT JOIN public.reception_campaigns c ON t.campaign_id = c.id
LEFT JOIN public.reception_suppliers s ON t.supplier_id = s.id
LEFT JOIN public.reception_products p ON t.product_id = p.id
LEFT JOIN public.reception_weighings w ON t.id = w.ticket_id;

GRANT SELECT ON public.v_reception_global TO authenticated;

-- Correction de la fonction KPI pour s'assurer du cumul en kg
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
    SELECT 'Matin (6h-14h)' as p_name, (p_target_date + interval '6 hours') as start_ts, (p_target_date + interval '14 hours') as end_ts
    UNION ALL
    SELECT 'Après-midi (14h-22h)', (p_target_date + interval '14 hours'), (p_target_date + interval '22 hours')
    UNION ALL
    SELECT 'Nuit (22h-6h)', (p_target_date + interval '22 hours'), (p_target_date + interval '30 hours')
  ),
  period_data AS (
    SELECT 
      p.p_name,
      t.taux_abattement,
      COALESCE(w.poids_brut * (1 - t.taux_abattement / 100.0), 0) as net,
      COALESCE(w.poids_brut * (t.taux_abattement / 100.0), 0) as abat,
      t.id
    FROM periods p
    INNER JOIN public.reception_tickets t ON 
      t.cloture_at >= p.start_ts AND t.cloture_at < p.end_ts
      AND t.statut IN ('cloture', 'pese_importe')
    LEFT JOIN public.reception_weighings w ON t.id = w.ticket_id
  )
  SELECT 
    p.p_name,
    COALESCE(avg(pd.taux_abattement), 0)::numeric,
    COALESCE(sum(pd.net), 0)::numeric,
    COALESCE(sum(pd.abat), 0)::numeric,
    count(pd.id)::integer
  FROM periods p
  LEFT JOIN period_data pd ON pd.p_name = p.p_name
  GROUP BY p.p_name, p.start_ts
  ORDER BY p.start_ts;
END;
$function$;
